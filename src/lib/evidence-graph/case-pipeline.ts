/**
 * Decision Twin case pipeline: from a case's documents, statement spans, structured facts and conclusions to a
 * sealed SDEP evidence graph. This is the integrated path the product's parts already define, assembled for any case
 * rather than the one hand-built DT-PC-001 graph:
 *
 *  1. Sources: SourceDocument → SourceVersion (content SHA-256) → EvidenceSpan (character locator, hash-anchored).
 *  2. Contradictions: `combineLayers` (deterministic layer + optional AI-candidate layer with the deterministic veto).
 *     Deterministic findings and AI candidates become Contradiction nodes; vetoed candidates are returned for audit.
 *  3. Versions: `supersedes` adds Supersedes edges (the replacing span → the replaced span).
 *  4. Conclusions: Conclusion nodes, with DependsOn edges to the spans the AI layer proposes (unreviewed); a
 *     superseded span is replaced by the span that supersedes it. Without an AI layer conclusions stay unlinked.
 *  5. Integrity: `checkIntegrity`; dependencies by graph traversal (`dependenciesOf`); impact of each contradiction
 *     by `conclusionsDependingOn` (which conclusions it reopens).
 *  6. Seal: `sdepDigest`, the SHA-256 of the canonical graph, so the same inputs and the same model answer always give
 *     the same digest.
 *
 * No network and no key here: the model call, if any, is inside the injected reader.
 */
import { createHash } from 'node:crypto';
import { combineLayers, NO_AI_CANDIDATES, supersedes, type CandidateContext, type LayeredResult } from '@/lib/contradiction/detect';
import type { createAiReader } from '@/lib/contradiction/ai-candidates';
import { normalizeFact, type Fact } from '@/lib/contradiction/normalize';
import { checkIntegrity, conclusionsDependingOn, dependenciesOf, sdepDigest, type IntegrityReport } from './integrity';
import { SDEP_PROTOCOL, SDEP_VERSION, type SdepDocument, type SdepEdge, type SdepNode } from './schema';

export const PIPELINE_VERSION = 'case-pipeline/1.0.0';

export interface CaseInput {
  id: string;
  question: string;
  tenant: string | null;
  documents: { id: string; title: string; text: string }[];
  spans: { id: string; doc: string; start: number; end: number; text: string }[];
  facts: Fact[];
  conclusions: { id: string; text: string }[];
}

export interface CaseResult {
  sdep: SdepDocument;
  sha256: string;
  integrity: IntegrityReport;
  layers: LayeredResult;
  /** Per conclusion: the spans cited as evidence and every span it depends on (graph traversal), after supersession. */
  citations: Record<string, string[]>;
  dependencies: Record<string, string[]>;
  /** Per contradiction (by pair key): the conclusions it reopens. */
  impact: Record<string, string[]>;
  ai: { used: boolean; parseOk: boolean | null; dropped: number };
}

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const safe = (s: string) => s.replace(/[^A-Za-z0-9._:#@/-]/g, '_');
const spanNode = (id: string) => `span:${safe(id)}`;
const spanOf = (node: string) => node.slice('span:'.length);

export async function runCasePipeline(c: CaseInput, opts: { reader?: ReturnType<typeof createAiReader>; createdAt?: string; model?: { provider: string; version: string } | null } = {}): Promise<CaseResult> {
  const ctx: CandidateContext = { documents: c.documents, spans: c.spans, conclusions: c.conclusions };
  const nodes: SdepNode[] = [];
  const edges: SdepEdge[] = [];
  const permission = c.tenant ? `tenant ${c.tenant} only` : 'public';
  const prov = (o: Partial<NonNullable<SdepNode['provenance']>>): NonNullable<SdepNode['provenance']> => ({ contentSha256: null, version: null, locator: null, period: null, unit: null, basis: null, extractionMethod: null, verification: 'unverified', permission, retrievedAt: null, ...o });

  // 1. Sources
  const verSha = new Map<string, string>();
  for (const d of c.documents) {
    const h = sha(d.text);
    verSha.set(d.id, h);
    nodes.push({ id: `doc:${safe(d.id)}`, kind: 'SourceDocument', label: d.title, tenant: c.tenant, provenance: prov({ contentSha256: h }) });
    nodes.push({ id: `ver:${safe(d.id)}@${h.slice(0, 12)}`, kind: 'SourceVersion', label: `${d.title} (as received)`, tenant: c.tenant, provenance: prov({ contentSha256: h, version: h.slice(0, 12) }) });
    edges.push({ from: `ver:${safe(d.id)}@${h.slice(0, 12)}`, to: `doc:${safe(d.id)}`, type: 'DerivedFrom' });
  }
  const facts = new Map(c.facts.map((f) => [f.id, f]));
  for (const s of c.spans) {
    const f = facts.get(s.id);
    const n = f ? normalizeFact(f) : null;
    const context = n ? Object.fromEntries(Object.entries({ ...n.context, entity: n.context.entity ? `${n.context.entity}${n.legalForm ? ` [${n.legalForm}]` : ''}` : null, measure: n.context.concept, approximate: n.approximate ? 'true' : null }).filter(([, v]) => typeof v === 'string' && v)) as Record<string, string> : undefined;
    const h = verSha.get(s.doc)!;
    nodes.push({
      id: spanNode(s.id), kind: 'EvidenceSpan', label: s.text, tenant: c.tenant, sourceSha256: h,
      ...(n && (n.canonicalValue !== null || typeof f!.value === 'string' || typeof f!.value === 'boolean') ? { value: n.canonicalValue ?? (f!.value as string | boolean) } : {}),
      provenance: prov({ contentSha256: h, locator: { type: 'chars', start: s.start, end: s.end }, period: f?.period ?? null, unit: f?.unit ?? null, basis: f?.basis ?? null, version: f?.version ?? null, extractionMethod: 'structured transcription of the statement (annotator)' }),
      ...(context ? { context } : {}),
    });
    edges.push({ from: spanNode(s.id), to: `ver:${safe(s.doc)}@${h.slice(0, 12)}`, type: 'Quotes' });
  }

  // 2. Contradictions
  const layers = await combineLayers(c.facts, opts.reader?.source ?? NO_AI_CANDIDATES, ctx);
  const recorded: { key: string; facts: string[] }[] = [];
  layers.deterministic.forEach((f, k) => {
    const id = `contradiction:det-${k + 1}`;
    nodes.push({ id, kind: 'Contradiction', label: `${f.class}: ${f.facts.join(' / ')}`, tenant: c.tenant, contradictionClass: f.class, note: `deterministic rule: ${f.rule}` });
    for (const x of f.facts) edges.push({ from: id, to: spanNode(x), type: 'Contradicts' });
    recorded.push({ key: [...f.facts].sort().join('|'), facts: f.facts });
  });
  layers.candidates.forEach((f, k) => {
    const id = `contradiction:ai-${k + 1}`;
    nodes.push({ id, kind: 'Contradiction', label: `${f.class} (AI candidate): ${f.facts.join(' / ')}`, tenant: c.tenant, contradictionClass: f.class, note: `AI candidate from ${f.source}; requires human review` });
    for (const x of f.facts) edges.push({ from: id, to: spanNode(x), type: 'Contradicts' });
    recorded.push({ key: [...f.facts].sort().join('|'), facts: f.facts });
  });

  // 3. Versions
  const replacedBy = new Map<string, string>();
  for (let i = 0; i < c.facts.length; i++) for (let j = i + 1; j < c.facts.length; j++) {
    const newer = supersedes(c.facts[i], c.facts[j]);
    if (!newer) continue;
    const older = newer === c.facts[i].id ? c.facts[j].id : c.facts[i].id;
    replacedBy.set(older, newer);
    edges.push({ from: spanNode(newer), to: spanNode(older), type: 'Supersedes' });
  }
  const current = (id: string) => {
    let x = id;
    for (let guard = 0; replacedBy.has(x) && guard < 10; guard++) x = replacedBy.get(x)!;
    return x;
  };

  // 4. Conclusions
  const reading = opts.reader && c.documents.length ? await opts.reader.read(ctx) : null;
  const citations: Record<string, string[]> = {};
  for (const concl of c.conclusions) {
    const id = `conclusion:${safe(concl.id)}`;
    nodes.push({ id, kind: 'Conclusion', label: concl.text, tenant: c.tenant, ...(reading ? { note: 'evidence links proposed by the AI-candidate layer; not reviewed' } : {}) });
    citations[concl.id] = [...new Set((reading?.citations[concl.id] ?? []).map(current))].sort();
    const linked = new Set([...(reading?.dependencies[concl.id] ?? []), ...(reading?.citations[concl.id] ?? [])].map(current));
    for (const s of [...linked].sort()) edges.push({ from: id, to: spanNode(s), type: 'DependsOn' });
  }

  const sdep: SdepDocument = {
    protocol: SDEP_PROTOCOL,
    version: SDEP_VERSION,
    id: `sdep:${safe(c.id)}`,
    question: c.question,
    createdAt: opts.createdAt ?? '2026-10-21T00:00:00.000Z',
    software: { producer: `AbrahamMoses Decision Twin ${PIPELINE_VERSION}`, engine: null, ruleset: 'contradiction layers 2026-10-21', model: reading ? (opts.model ?? null) : null },
    nodes,
    edges,
  };

  // 5. Integrity, dependencies, impact
  const integrity = checkIntegrity(sdep);
  const spanIds = new Set(c.spans.map((s) => spanNode(s.id)));
  const dependencies = Object.fromEntries(c.conclusions.map((x) => [x.id, dependenciesOf(sdep, `conclusion:${safe(x.id)}`).filter((n) => spanIds.has(n)).map(spanOf).sort()]));
  const impact: Record<string, string[]> = {};
  for (const r of recorded) impact[r.key] = [...new Set(r.facts.flatMap((x) => conclusionsDependingOn(sdep, spanNode(x)).conclusions.map((n) => n.slice('conclusion:'.length))))].sort();

  return { sdep, sha256: sdepDigest(sdep), integrity, layers, citations, dependencies, impact, ai: { used: !!reading, parseOk: reading ? reading.parseOk : null, dropped: reading?.dropped ?? 0 } };
}
