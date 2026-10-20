/**
 * SDEP integrity checker: deterministic, no network, no language model.
 *
 * Validates a document against the schema, then checks the graph: identifiers, references, edge rules, dependency
 * cycles, tenant isolation, source anchoring and version hashes, evidence for verified claims and conclusions,
 * duplicate evidence, shared ancestry (one source counted twice is not corroboration), unrecorded contradictions and
 * use of superseded nodes. Also answers "every conclusion depending on this node".
 */
import { canonicalJson, hashOf } from '@/lib/decision/canonical';
import { EDGE_RULES, SDEP_QUESTIONS, SUPPORTED_VERSIONS, SdepDocumentSchema, type NodeKind, type QuestionId, type SdepDocument, type SdepNode } from './schema';

export type Severity = 'error' | 'warning';
export interface Finding {
  code: string;
  severity: Severity;
  message: string;
  nodes: string[];
}

export interface IntegrityReport {
  ok: boolean;
  /** SHA-256 of the canonical document (RFC 8785-style key ordering, see decision/canonical.ts). */
  sha256: string | null;
  findings: Finding[];
}

/** SHA-256 over the canonical JSON of the document. */
export function sdepDigest(doc: SdepDocument): string {
  return hashOf(doc);
}

/** Validate unknown input as an SDEP document of a supported version. */
export function parseSdep(input: unknown): { ok: true; doc: SdepDocument } | { ok: false; findings: Finding[] } {
  const version = (input as { version?: unknown } | null)?.version;
  if (typeof version === 'string' && !(SUPPORTED_VERSIONS as readonly string[]).includes(version)) {
    return { ok: false, findings: [{ code: 'UNSUPPORTED_VERSION', severity: 'error', message: `SDEP version ${version} is not supported (supported: ${SUPPORTED_VERSIONS.join(', ')}).`, nodes: [] }] };
  }
  const r = SdepDocumentSchema.safeParse(input);
  if (r.success) return { ok: true, doc: r.data };
  return {
    ok: false,
    findings: r.error.issues.map((i) => ({ code: 'SCHEMA_INVALID', severity: 'error' as const, message: `${i.path.join('.') || '(document)'}: ${i.message}`, nodes: [] })),
  };
}

/* ------------------------------------------------------------- graph views */

/** Dependency pairs [dependent, dependency] from every edge whose rule defines a dependent end. */
export function dependencyPairs(doc: SdepDocument): [string, string][] {
  const out: [string, string][] = [];
  for (const e of doc.edges) {
    const dep = EDGE_RULES[e.type].dependent;
    if (dep === 'from') out.push([e.from, e.to]);
    else if (dep === 'to') out.push([e.to, e.from]);
  }
  return out;
}

function index(doc: SdepDocument) {
  const nodes = new Map<string, SdepNode>();
  for (const n of doc.nodes) if (!nodes.has(n.id)) nodes.set(n.id, n);
  const dependencies = new Map<string, Set<string>>();
  const dependents = new Map<string, Set<string>>();
  for (const [a, b] of dependencyPairs(doc)) {
    if (!dependencies.has(a)) dependencies.set(a, new Set());
    dependencies.get(a)!.add(b);
    if (!dependents.has(b)) dependents.set(b, new Set());
    dependents.get(b)!.add(a);
  }
  return { nodes, dependencies, dependents };
}

function reach(start: string[], next: Map<string, Set<string>>): Set<string> {
  const seen = new Set<string>();
  const stack = [...start];
  while (stack.length) {
    const id = stack.pop()!;
    for (const n of next.get(id) ?? []) if (!seen.has(n)) {
      seen.add(n);
      stack.push(n);
    }
  }
  return seen;
}

/** Every node built, directly or transitively, on `nodeId`. */
export function dependentsOf(doc: SdepDocument, nodeId: string): string[] {
  const { dependents } = index(doc);
  return [...reach([nodeId], dependents)].sort();
}

/** Every node `nodeId` is built on, directly or transitively. */
export function dependenciesOf(doc: SdepDocument, nodeId: string): string[] {
  const { dependencies } = index(doc);
  return [...reach([nodeId], dependencies)].sort();
}

/** "Every conclusion depending on this passage": the Conclusions (and DecisionConditions) built on `nodeId`. */
export function conclusionsDependingOn(doc: SdepDocument, nodeId: string): { conclusions: string[]; conditions: string[] } {
  const { nodes } = index(doc);
  const all = dependentsOf(doc, nodeId);
  return {
    conclusions: all.filter((id) => nodes.get(id)?.kind === 'Conclusion'),
    conditions: all.filter((id) => nodes.get(id)?.kind === 'DecisionCondition'),
  };
}

export interface PathStep {
  node: string;
  kind: NodeKind | null;
  label: string | null;
  /** Edge type leading from the previous step to this one (null for the first step). */
  via: string | null;
}

/**
 * The dependency paths from `from` up to `to` (each step is built on the previous one), shortest first, at most
 * `limit` of them, with the total number of distinct paths. Assumes an acyclic graph (checked by `checkIntegrity`).
 */
export function dependencyPaths(doc: SdepDocument, from: string, to: string, limit = 5): { total: number; paths: PathStep[][] } {
  const { nodes, dependents } = index(doc);
  const viaOf = new Map<string, string>();
  for (const e of doc.edges) {
    const dep = EDGE_RULES[e.type].dependent;
    if (dep === 'from') viaOf.set(`${e.to}>${e.from}`, e.type);
    else if (dep === 'to') viaOf.set(`${e.from}>${e.to}`, e.type);
  }
  const reaches = reach([to], index(doc).dependencies);
  reaches.add(to);
  const count = new Map<string, number>();
  const total = (id: string): number => {
    if (id === to) return 1;
    if (count.has(id)) return count.get(id)!;
    let n = 0;
    for (const next of dependents.get(id) ?? []) if (reaches.has(next)) n += total(next);
    count.set(id, n);
    return n;
  };
  const paths: string[][] = [];
  // Breadth-first so the shortest paths come first.
  let frontier: string[][] = [[from]];
  while (frontier.length && paths.length < limit) {
    const next: string[][] = [];
    for (const p of frontier) {
      const last = p[p.length - 1];
      if (last === to) {
        if (paths.length < limit) paths.push(p);
        continue;
      }
      for (const n of [...(dependents.get(last) ?? [])].sort()) if (reaches.has(n) && !p.includes(n)) next.push([...p, n]);
    }
    frontier = next;
  }
  return {
    total: reaches.has(from) ? total(from) : 0,
    paths: paths.map((p) => p.map((id, i) => ({ node: id, kind: nodes.get(id)?.kind ?? null, label: nodes.get(id)?.label ?? null, via: i === 0 ? null : viaOf.get(`${p[i - 1]}>${id}`) ?? null }))),
  };
}

/** The distinct SourceDocuments a node ultimately rests on. Two spans of one document are one source. */
export function rootSources(doc: SdepDocument, nodeId: string): string[] {
  const { nodes } = index(doc);
  return dependenciesOf(doc, nodeId).filter((id) => nodes.get(id)?.kind === 'SourceDocument');
}

/* ----------------------------------------------------------------- checks */

const REQUIRED: Partial<Record<NodeKind, (n: SdepNode) => string | null>> = {
  SourceDocument: (n) => (n.provenance ? null : 'provenance'),
  SourceVersion: (n) => (n.provenance?.contentSha256 ? null : 'provenance.contentSha256'),
  EvidenceSpan: (n) => (!n.provenance ? 'provenance' : !n.provenance.locator ? 'provenance.locator' : !n.sourceSha256 ? 'sourceSha256' : null),
  Calculation: (n) => (n.formula ? null : 'formula'),
  DecisionCondition: (n) => (n.status ? null : 'status'),
  Contradiction: (n) => (n.contradictionClass ? null : 'contradictionClass'),
};

/** Context keys that must all match for two values to be the same measure. */
const SAME_MEASURE = ['entity', 'measure', 'period', 'unit', 'basis'] as const;

export function checkIntegrity(input: unknown): IntegrityReport {
  const parsed = parseSdep(input);
  if (!parsed.ok) return { ok: false, sha256: null, findings: parsed.findings };
  const doc = parsed.doc;
  const findings: Finding[] = [];
  const add = (code: string, severity: Severity, message: string, nodes: string[] = []) => findings.push({ code, severity, message, nodes });

  // Identifiers
  const seen = new Set<string>();
  for (const n of doc.nodes) {
    if (seen.has(n.id)) add('DUPLICATE_NODE_ID', 'error', `Node id ${n.id} is used more than once.`, [n.id]);
    seen.add(n.id);
  }
  const { nodes } = index(doc);

  // Required fields per kind
  for (const n of doc.nodes) {
    const missing = REQUIRED[n.kind]?.(n);
    if (missing) add('MISSING_FIELD', 'error', `${n.kind} ${n.id} has no ${missing}.`, [n.id]);
  }

  // Edges: references, rules, self-edges, duplicates, tenants
  const edgeKeys = new Set<string>();
  for (const e of doc.edges) {
    const key = `${e.from}|${e.type}|${e.to}`;
    if (edgeKeys.has(key)) add('DUPLICATE_EDGE', 'warning', `Edge ${e.from} -${e.type}-> ${e.to} appears more than once.`, [e.from, e.to]);
    edgeKeys.add(key);
    const a = nodes.get(e.from);
    const b = nodes.get(e.to);
    if (!a || !b) {
      add('BROKEN_REF', 'error', `Edge ${e.from} -${e.type}-> ${e.to} refers to a node that does not exist (${[!a && e.from, !b && e.to].filter(Boolean).join(', ')}).`, [e.from, e.to]);
      continue;
    }
    if (e.from === e.to) add('SELF_EDGE', 'error', `${e.from} has a ${e.type} edge to itself.`, [e.from]);
    const rule = EDGE_RULES[e.type];
    if (!rule.from.includes(a.kind) || !rule.to.includes(b.kind)) {
      add('EDGE_KIND_NOT_ALLOWED', 'error', `${e.type} is not allowed from ${a.kind} (${a.id}) to ${b.kind} (${b.id}).`, [a.id, b.id]);
    }
    if (a.tenant !== null && b.tenant !== null && a.tenant !== b.tenant) {
      add('CROSS_TENANT_EDGE', 'error', `Edge ${a.id} -${e.type}-> ${b.id} crosses tenants (${a.tenant} / ${b.tenant}).`, [a.id, b.id]);
    }
  }
  // A public node must not be built on a tenant's private node (it would disclose it).
  for (const [dependent, dependency] of dependencyPairs(doc)) {
    const a = nodes.get(dependent);
    const b = nodes.get(dependency);
    if (a && b && a.tenant === null && b.tenant !== null) {
      add('PRIVATE_DEPENDENCY_IN_PUBLIC_NODE', 'error', `Public node ${a.id} is built on ${b.id}, which belongs to tenant ${b.tenant}.`, [a.id, b.id]);
    }
  }

  // Dependency cycles
  const { dependencies } = index(doc);
  const state = new Map<string, 1 | 2>();
  const reported = new Set<string>();
  const visit = (id: string, path: string[]) => {
    state.set(id, 1);
    for (const next of dependencies.get(id) ?? []) {
      if (state.get(next) === 1) {
        const cycle = [...path.slice(path.indexOf(next)), next];
        const key = [...cycle].sort().join(',');
        if (!reported.has(key)) {
          reported.add(key);
          add('DEPENDENCY_CYCLE', 'error', `Dependency cycle: ${cycle.join(' -> ')}.`, cycle);
        }
      } else if (!state.has(next)) visit(next, [...path, next]);
    }
    state.set(id, 2);
  };
  for (const n of doc.nodes) if (!state.has(n.id)) visit(n.id, [n.id]);

  // Source anchoring and versions
  const outgoing = (id: string, type: string) => doc.edges.filter((e) => e.from === id && e.type === type).map((e) => nodes.get(e.to)).filter((x): x is SdepNode => !!x);
  const incoming = (id: string, type: string) => doc.edges.filter((e) => e.to === id && e.type === type).map((e) => nodes.get(e.from)).filter((x): x is SdepNode => !!x);
  for (const n of doc.nodes) {
    if (n.kind === 'SourceVersion' && !outgoing(n.id, 'DerivedFrom').some((d) => d.kind === 'SourceDocument')) {
      add('VERSION_WITHOUT_DOCUMENT', 'error', `SourceVersion ${n.id} is not derived from any SourceDocument.`, [n.id]);
    }
    if (n.kind === 'EvidenceSpan') {
      const quoted = outgoing(n.id, 'Quotes');
      if (!quoted.length) add('UNANCHORED_EVIDENCE', 'error', `EvidenceSpan ${n.id} does not quote any SourceVersion.`, [n.id]);
      for (const v of quoted) {
        if (n.sourceSha256 && v.provenance?.contentSha256 && n.sourceSha256 !== v.provenance.contentSha256) {
          add('VERSION_MISMATCH', 'error', `EvidenceSpan ${n.id} was taken from content ${n.sourceSha256.slice(0, 12)}…, but ${v.id} has content ${v.provenance.contentSha256.slice(0, 12)}….`, [n.id, v.id]);
        }
      }
    }
  }

  // Evidence for claims, conditions and conclusions
  const reachesEvidence = (id: string) => dependenciesOf(doc, id).some((d) => nodes.get(d)?.kind === 'EvidenceSpan');
  for (const n of doc.nodes) {
    if (n.kind === 'VerifiedClaim' && !incoming(n.id, 'Supports').some((s) => s.kind === 'EvidenceSpan')) {
      add('MISSING_EVIDENCE', 'error', `VerifiedClaim ${n.id} has no supporting EvidenceSpan.`, [n.id]);
    }
    if (n.kind === 'Conclusion' && !reachesEvidence(n.id)) add('MISSING_EVIDENCE', 'error', `Conclusion ${n.id} does not rest on any evidence.`, [n.id]);
    if (n.kind === 'DecisionCondition' && n.status === 'MET' && !reachesEvidence(n.id)) {
      add('MISSING_EVIDENCE', 'error', `Condition ${n.id} is MET without resting on any evidence.`, [n.id]);
    }
  }

  // Duplicate evidence: the same passage of the same version recorded twice
  const spanKey = new Map<string, string>();
  for (const n of doc.nodes) {
    if (n.kind !== 'EvidenceSpan' || !n.sourceSha256 || !n.provenance?.locator) continue;
    const key = `${n.sourceSha256}|${canonicalJson(n.provenance.locator)}`;
    const other = spanKey.get(key);
    if (other) add('DUPLICATE_EVIDENCE', 'warning', `EvidenceSpans ${other} and ${n.id} are the same passage of the same source version.`, [other, n.id]);
    else spanKey.set(key, n.id);
  }

  // Shared ancestry: several supports that all rest on one source are not independent corroboration
  for (const n of doc.nodes) {
    const supports = incoming(n.id, 'Supports');
    if (supports.length < 2) continue;
    const roots = new Set(supports.flatMap((s) => (s.kind === 'SourceDocument' ? [s.id] : rootSources(doc, s.id))));
    if (roots.size === 1) {
      add('SHARED_ANCESTRY', 'warning', `${n.id} has ${supports.length} supports, all from one source (${[...roots][0]}): not independent corroboration.`, [n.id, ...supports.map((s) => s.id)]);
    }
  }

  // Unrecorded contradictions: same measure in the same context with different values, and no Contradiction node
  const contradicted = new Map<string, Set<string>>();
  for (const c of doc.nodes.filter((x) => x.kind === 'Contradiction')) {
    const targets = outgoing(c.id, 'Contradicts');
    if (!targets.length) add('CONTRADICTION_WITHOUT_TARGETS', 'error', `Contradiction ${c.id} involves no node.`, [c.id]);
    for (const t of targets) {
      if (!contradicted.has(t.id)) contradicted.set(t.id, new Set());
      for (const u of targets) if (u.id !== t.id) contradicted.get(t.id)!.add(u.id);
    }
  }
  const measured = doc.nodes.filter((n) => n.context && SAME_MEASURE.every((k) => n.context![k]) && n.value !== undefined && n.value !== null);
  for (let i = 0; i < measured.length; i++) {
    for (let j = i + 1; j < measured.length; j++) {
      const a = measured[i];
      const b = measured[j];
      if (!SAME_MEASURE.every((k) => a.context![k] === b.context![k])) continue;
      if (canonicalJson(a.value) === canonicalJson(b.value)) continue;
      if (contradicted.get(a.id)?.has(b.id)) continue;
      add('UNRECORDED_CONTRADICTION', 'error', `${a.id} (${a.value}) and ${b.id} (${b.value}) report the same measure in the same context with different values, and no Contradiction records it.`, [a.id, b.id]);
    }
  }

  // Superseded nodes still in use
  const superseded = new Set(doc.edges.filter((e) => e.type === 'Supersedes').map((e) => e.to));
  for (const [dependent, dependency] of dependencyPairs(doc)) {
    if (superseded.has(dependency) && !superseded.has(dependent)) {
      add('SUPERSEDED_IN_USE', 'warning', `${dependent} still depends on ${dependency}, which has been superseded.`, [dependent, dependency]);
    }
  }

  return { ok: !findings.some((f) => f.severity === 'error'), sha256: sdepDigest(doc), findings };
}

/* --------------------------------------------------------------- coverage */

/** Which of the 14 SDEP questions this document answers, and from what. Absent answers are reported, not filled. */
export function answerCoverage(doc: SdepDocument): { id: QuestionId; question: string; answered: boolean; basis: string }[] {
  const count = (k: NodeKind) => doc.nodes.filter((n) => n.kind === k).length;
  const has = (k: NodeKind) => count(k) > 0;
  const sourcesHashed = doc.nodes.filter((n) => n.kind === 'SourceVersion').every((n) => !!n.provenance?.contentSha256) && has('SourceVersion');
  const calcUsesAssumption = doc.edges.some((e) => e.type === 'UsesAssumption' || (e.type === 'ComputedUsing' && doc.nodes.find((n) => n.id === e.to)?.kind === 'Assumption'));
  const a: Record<QuestionId, [boolean, string]> = {
    Q1: [doc.question.length > 0, 'document question'],
    Q2: [has('EvidenceSpan'), `${count('EvidenceSpan')} evidence spans from ${count('SourceDocument')} documents`],
    Q3: [sourcesHashed, 'every SourceVersion carries a content hash'],
    Q4: [has('VerifiedClaim') || has('ExtractedClaim') || has('DisputedClaim'), `${count('VerifiedClaim')} verified, ${count('ExtractedClaim')} extracted, ${count('DisputedClaim')} disputed claims`],
    Q5: [has('Assumption'), `${count('Assumption')} assumptions`],
    Q6: [has('Calculation'), `${count('Calculation')} calculations`],
    Q7: [has('Alternative'), `${count('Alternative')} alternatives`],
    Q8: [has('Calculation') && calcUsesAssumption, 'calculations are linked to the assumptions they use (dependency trace, no counterfactual run yet)'],
    Q9: [has('Contradiction') || doc.nodes.some((n) => n.kind === 'DecisionCondition' && n.status !== 'MET'), `${count('Contradiction')} contradictions; conditions not met or open`],
    Q10: [has('HumanAttestation'), `${count('HumanAttestation')} human attestations`],
    Q11: [has('DecisionSnapshot') || has('Conclusion'), `${count('DecisionSnapshot')} snapshots, ${count('Conclusion')} conclusions`],
    Q12: [!!doc.software.engine || !!doc.software.ruleset || has('Rule'), `producer ${doc.software.producer}${doc.software.engine ? `, engine ${doc.software.engine.version}` : ''}${doc.software.ruleset ? `, ruleset ${doc.software.ruleset}` : ''}`],
    Q13: [sourcesHashed && !!doc.software.engine?.sha256, 'source content hashes and a pinned engine digest'],
    Q14: [has('MonitoringSignal'), `${count('MonitoringSignal')} monitoring signals`],
  };
  return SDEP_QUESTIONS.map((q) => ({ id: q.id, question: q.question, answered: a[q.id][0], basis: a[q.id][1] }));
}
