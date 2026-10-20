/**
 * Operations shared by the REST API and the MCP server.
 *
 * The two interfaces are documented and versioned separately, as they should
 * be — REST for applications, MCP for agents — but they call these functions,
 * so they cannot disagree about what the record says.
 */

import { z } from 'zod/v4';
import { EPISTEMIC_STATUS_OF, STATUS_LABELS, SimulationInputError, downstreamOf, lensAxioms, simulate, upstreamOf } from '@/lib/record/engine';
import { EPISTEMIC_STATUSES } from '@/lib/epistemic';
import { citationFormats } from '@/lib/record/provenance';
import { generateProvenance } from '@/lib/record/provenance';
import { revisionHash, type AbrahamMosesRecord } from '@/lib/record/record';
import { search } from '@/lib/record/search';
import { CLAIM_CLASSIFICATIONS, CORPUS_CATEGORY_META, TRADITION_FAMILIES, type CorpusCategory } from '@/lib/record/taxonomy';
import { absoluteUrl, canonicalOrigin } from '@/lib/site/config';
import { ApiError } from './http';
import {
  CitationV1,
  ClaimSummaryV1,
  DerivationV1,
  ProvenanceV1,
  ReferenceV1,
  SearchV1,
  SimulationV1,
  caseView,
  claimSummary,
  claimView,
  derivationView,
  referenceView,
  simulationView,
} from './views';

type R = AbrahamMosesRecord;

const CODE = /^AM-CLAIM-\d{6}$/i;

function requireClaim(record: R, code: string) {
  if (!CODE.test(code)) throw new ApiError('invalid_parameter', `“${code}” is not a claim code. Claim codes look like AM-CLAIM-000184.`);
  const claim = record.claim(code);
  if (!claim) throw new ApiError('not_found', `No published claim has the code ${code.toUpperCase()}.`);
  return claim;
}

function requireRevision(record: R, code: string, rev?: number) {
  const claim = requireClaim(record, code);
  if (rev !== undefined && !record.revision(claim, rev)) {
    throw new ApiError('not_found', `${claim.code} has no public revision ${rev}. It has ${claim.revisions.length}.`);
  }
  return claim;
}

/* ------------------------------------------------------------------ *
 * Claims
 * ------------------------------------------------------------------ */

export const ClaimFilters = z.object({
  topic: z.string().max(100).optional().describe('Case-insensitive topic, e.g. Priesthood, Torah, Abraham'),
  classification: z.enum(CLAIM_CLASSIFICATIONS).optional().describe('Claim classification'),
  role: z.enum(['thesis', 'lemma', 'parent', 'position']).optional(),
  case: z.string().max(100).optional().describe('Research case slug'),
  tradition: z.string().max(100).optional().describe('Tradition id; matches claims attributed to it or with a recorded stance from it'),
  status: z.enum(['provisional', 'published', 'externally_reviewed', 'withdrawn']).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export function listClaims(record: R, f: z.infer<typeof ClaimFilters>) {
  const all = record.data.claims.filter((c) => {
    const r = record.current(c);
    if (f.topic && c.topic.toLowerCase() !== f.topic.toLowerCase()) return false;
    if (f.classification && r.classification !== f.classification) return false;
    if (f.role && c.role !== f.role) return false;
    if (f.case && !c.cases.includes(f.case)) return false;
    if (f.status && r.status !== f.status) return false;
    if (f.tradition && !r.attribution.traditions.includes(f.tradition) && !r.acceptance.some((a) => a.tradition === f.tradition)) return false;
    return true;
  });
  return {
    data: all.slice(f.offset, f.offset + f.limit).map((c) => claimSummary(record, c)),
    total: all.length,
    limit: f.limit,
    offset: f.offset,
  };
}

export function getClaim(record: R, code: string, rev?: number) {
  const claim = requireRevision(record, code, rev);
  return claimView(record, claim, rev);
}

export const RevisionV1 = z.object({
  object: z.literal('claim_revision'),
  code: z.string(),
  rev: z.number().int(),
  status: z.string(),
  published_at: z.string(),
  statement: z.string(),
  classification: z.string(),
  change_note: z.string(),
  machine_involvement: z.string(),
  content_hash: z.string(),
  url: z.string(),
});

export function listRevisions(record: R, code: string): Array<z.infer<typeof RevisionV1>> {
  const claim = requireClaim(record, code);
  return claim.revisions.map((r) => ({
    object: 'claim_revision',
    code: claim.code,
    rev: r.rev,
    status: r.status,
    published_at: r.publishedAt,
    statement: r.statement,
    classification: r.classification,
    change_note: r.editorial.changeNote,
    machine_involvement: r.machine.level,
    content_hash: revisionHash(claim.code, r),
    url: absoluteUrl(`/claims/${claim.code}?rev=${r.rev}`),
  }));
}

export function getProvenance(record: R, code: string, rev?: number): z.infer<typeof ProvenanceV1> {
  const claim = requireRevision(record, code, rev);
  const r = (rev && record.revision(claim, rev)) || record.current(claim);
  return {
    object: 'provenance_chain',
    claim: { code: claim.code, statement: r.statement, revision: r.rev },
    steps: generateProvenance(record, claim, r.rev),
  };
}

export const DependenciesV1 = z.object({
  object: z.literal('claim_dependencies'),
  code: z.string(),
  grounded_in_witness: z.boolean(),
  derivations: z.array(DerivationV1),
  upstream: z.object({ claims: z.array(z.string()), axioms: z.array(z.string()) }),
  supports: z.array(z.string()),
  downstream: z.array(z.string()),
});

export function getDependencies(record: R, code: string): z.infer<typeof DependenciesV1> {
  const claim = requireClaim(record, code);
  const graph = record.graph();
  return {
    object: 'claim_dependencies',
    code: claim.code,
    grounded_in_witness: graph.claims.find((c) => c.code === claim.code)!.grounded,
    derivations: record.derivationsOf(claim.code).map((d) => derivationView(record, d.code)),
    upstream: upstreamOf(graph, claim.code),
    supports: [...new Set(record.dependentsOf(claim.code).map((d) => d.claim))].sort(),
    downstream: downstreamOf(graph, claim.code),
  };
}

export function getCitation(record: R, code: string, rev?: number): z.infer<typeof CitationV1> {
  const claim = requireRevision(record, code, rev);
  const r = (rev && record.revision(claim, rev)) || record.current(claim);
  return { object: 'citation', code: claim.code, revision: r.rev, ...citationFormats(record, claim, r.rev, canonicalOrigin()) };
}

/* ------------------------------------------------------------------ *
 * Simulation
 * ------------------------------------------------------------------ */

const codeList = z
  .union([z.array(z.string()), z.string()])
  .optional()
  .transform((v) =>
    (Array.isArray(v) ? v : (v ?? '').split(','))
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean),
  );

export const SimulationParams = z.object({
  reject_claims: codeList.describe('Claim codes to reject, e.g. AM-CLAIM-000186 (array, or comma-separated in a query string)'),
  reject_axioms: codeList.describe('Axiom codes to reject, e.g. AM-AX-002'),
  lens: z.string().max(60).optional().describe('Tradition id: rejects every axiom that tradition rejects or sets aside'),
});

export function runSimulation(record: R, p: z.infer<typeof SimulationParams>): z.infer<typeof SimulationV1> {
  if (p.lens && !record.tradition(p.lens)) {
    throw new ApiError('invalid_parameter', `Unknown tradition “${p.lens}”.`, {
      known: record.data.traditions.map((t) => t.id),
    });
  }
  try {
    const result = simulate(record.graph(), {
      rejectClaims: p.reject_claims,
      rejectAxioms: p.reject_axioms,
      lens: p.lens ?? null,
    });
    return simulationView(record, result);
  } catch (err) {
    if (err instanceof SimulationInputError) {
      throw new ApiError('invalid_parameter', err.message, { unknown: err.unknown });
    }
    throw err;
  }
}

/* ------------------------------------------------------------------ *
 * Search
 * ------------------------------------------------------------------ */

export const SearchParams = z.object({
  q: z.string().min(1).max(500).describe('A research question, a scripture reference, or terms'),
  limit: z.coerce.number().int().min(1).max(25).default(10),
});

export function searchRecord(record: R, p: z.infer<typeof SearchParams>): z.infer<typeof SearchV1> {
  const s = search(record, p.q, { limit: p.limit });
  return {
    object: 'search_results',
    query: s.query,
    record_version: record.version,
    generated_text: false,
    guardrail: s.guardrail
      ? { kind: s.guardrail.kind, message: s.guardrail.message, suggested_questions: s.guardrail.suggestedClaims }
      : null,
    references: s.references.map((r) => ({ display: r.display, work: r.work })),
    research_case: s.bestCase
      ? { slug: s.bestCase.slug, title: s.bestCase.title, question: s.bestCase.question, url: absoluteUrl(`/research/${s.bestCase.slug}`) }
      : null,
    claims: s.claims.map((c) => ({ ...claimSummary(record, c.claim), score: c.score, matched: c.matched })),
    other: s.hits
      .filter((h) => h.kind !== 'claim')
      .slice(0, p.limit)
      .map((h) => ({ kind: h.kind, code: h.id, score: h.score })),
  };
}

/* ------------------------------------------------------------------ *
 * Tradition comparator
 * ------------------------------------------------------------------ */

export const CompareV1 = z.object({
  object: z.literal('tradition_comparison'),
  case: z.string(),
  question: z.string(),
  record_version: z.string(),
  notice: z.string(),
  rows: z.array(
    z.object({
      tradition: z.string(),
      tradition_name: z.string(),
      family: z.string(),
      response: z.string(),
      summary: z.string(),
      categories: z.array(z.string()),
      position: z.string().nullable(),
      position_statement: z.string().nullable(),
      lens_rejects: z.array(z.string()),
      positions_under_lens: z.array(
        z.object({
          claim: z.string(),
          status: z.string().describe('Legacy engine value (stands | weakened | unwarranted | broken | rejected), kept for compatibility.'),
          epistemic_status: z.enum(EPISTEMIC_STATUSES),
          status_label: z.string(),
        }),
      ),
    }),
  ),
});

export function compareTraditions(record: R, slug: string): z.infer<typeof CompareV1> {
  const rc = record.researchCase(slug);
  if (!rc) throw new ApiError('not_found', `No research case “${slug}”.`, { known: record.data.cases.map((c) => c.slug) });
  const graph = record.graph();
  return {
    object: 'tradition_comparison',
    case: rc.slug,
    question: rc.question,
    record_version: record.version,
    notice:
      'Each row applies one tradition’s lens — removing the reading principles it rejects or sets aside — and shows which positions are still supported under that lens. A lens records explicit rejections only; principles a tradition does not address are left in place. Where a tradition asks a different question, the row says so.',
    rows: rc.responses.map((resp) => {
      const t = record.tradition(resp.tradition)!;
      const result = simulate(graph, { lens: t.id });
      return {
        tradition: t.id,
        tradition_name: t.name,
        family: t.family,
        response: resp.response,
        summary: resp.summary,
        categories: resp.categories,
        position: resp.position,
        position_statement: resp.position ? record.current(record.claim(resp.position)!).statement : null,
        lens_rejects: lensAxioms(graph, t.id),
        positions_under_lens: rc.positions.map((p) => ({
          claim: p.claim,
          status: result.statuses[p.claim],
          epistemic_status: EPISTEMIC_STATUS_OF[result.statuses[p.claim]],
          status_label: STATUS_LABELS[result.statuses[p.claim]],
        })),
      };
    }),
  };
}

/* ------------------------------------------------------------------ *
 * Corpus coverage and history
 * ------------------------------------------------------------------ */

export const CorpusV1 = z.object({
  object: z.literal('corpus'),
  record_version: z.string(),
  categories: z.array(
    z.object({ id: z.string(), ordinal: z.string(), label: z.string(), description: z.string(), includes: z.array(z.string()), works: z.number().int(), citations: z.number().int() }),
  ),
  works: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      cite_as: z.string(),
      category: z.string(),
      collection: z.string(),
      canonical_for: z.array(z.string()),
      edition: z.string(),
      publisher: z.string().nullable(),
      year: z.string().nullable(),
      language: z.string(),
      author: z.string().nullable(),
      date: z.string().nullable(),
      citations: z.number().int(),
      claims: z.array(z.string()),
    }),
  ),
  translations: z.array(z.object({ id: z.string(), name: z.string(), license: z.string(), verified: z.boolean() })),
});

/** Every reference in the record, grouped by the work it cites. */
export function citationIndex(record: R): Map<string, { count: number; claims: Set<string> }> {
  const index = new Map<string, { count: number; claims: Set<string> }>();
  const add = (work: string, claim?: string) => {
    const e = index.get(work) ?? { count: 0, claims: new Set<string>() };
    e.count += 1;
    if (claim) e.claims.add(claim);
    index.set(work, e);
  };
  for (const c of record.data.claims) {
    const r = record.current(c);
    for (const ref of [...r.primaryWitnesses, ...r.evidence.map((e) => e.reference), ...r.variants.map((v) => v.reference)]) add(ref.work, c.code);
  }
  for (const m of record.data.counterModels) for (const e of m.evidence) add(e.work);
  for (const e of [...record.data.covenants, ...record.data.doctrine]) for (const ref of e.evidence) add(ref.work);
  for (const a of record.data.axioms) for (const s of a.stances) for (const ref of s.references) add(ref.work);
  for (const rc of record.data.cases) for (const resp of rc.responses) for (const ref of resp.references) add(ref.work);
  return index;
}

export function corpus(record: R): z.infer<typeof CorpusV1> {
  const index = citationIndex(record);
  const works = record.data.works.map((w) => ({
    id: w.id,
    title: w.title,
    cite_as: w.citeAs,
    category: w.category,
    collection: w.collection,
    canonical_for: w.canonicalFor,
    edition: w.edition.title,
    publisher: w.edition.publisher,
    year: w.edition.year,
    language: w.edition.language,
    author: w.author,
    date: w.date,
    citations: index.get(w.id)?.count ?? 0,
    claims: [...(index.get(w.id)?.claims ?? [])].sort(),
  }));
  return {
    object: 'corpus',
    record_version: record.version,
    categories: (Object.keys(CORPUS_CATEGORY_META) as CorpusCategory[]).map((id) => ({
      id,
      ...CORPUS_CATEGORY_META[id],
      works: works.filter((w) => w.category === id).length,
      citations: works.filter((w) => w.category === id).reduce((s, w) => s + w.citations, 0),
    })),
    works,
    translations: record.data.translations.map((t) => ({ id: t.id, name: t.name, license: t.license, verified: t.verified })),
  };
}

export const ChangelogEntryV1 = z.object({
  object: z.literal('record_change'),
  code: z.string(),
  rev: z.number().int(),
  status: z.string(),
  published_at: z.string(),
  statement: z.string(),
  change_note: z.string(),
  url: z.string(),
});

export function changelog(record: R): Array<z.infer<typeof ChangelogEntryV1>> {
  return record.history().map(({ code, revision }) => ({
    object: 'record_change',
    code,
    rev: revision.rev,
    status: revision.status,
    published_at: revision.publishedAt,
    statement: revision.statement,
    change_note: revision.editorial.changeNote,
    url: absoluteUrl(`/claims/${code}?rev=${revision.rev}`),
  }));
}

export const CaseSummaryV1 = z.object({
  object: z.literal('research_case_summary'),
  slug: z.string(),
  field: z.string(),
  title: z.string(),
  question: z.string(),
  status: z.string(),
  url: z.string(),
});

export function listCases(record: R): Array<z.infer<typeof CaseSummaryV1>> {
  return record.data.cases.map((rc) => ({
    object: 'research_case_summary',
    slug: rc.slug,
    field: rc.field,
    title: rc.title,
    question: rc.question,
    status: rc.status,
    url: absoluteUrl(`/research/${rc.slug}`),
  }));
}

export function getCase(record: R, slug: string) {
  if (!record.researchCase(slug)) {
    throw new ApiError('not_found', `No research case “${slug}”.`, { known: record.data.cases.map((c) => c.slug) });
  }
  return caseView(record, slug);
}

export const NodeFilters = z.object({
  node: z.string().max(100).optional().describe('Node id or label, e.g. abraham'),
  topic: z.string().max(100).optional(),
  family: z.enum(TRADITION_FAMILIES).optional().describe('Restrict to one tradition family’s readings'),
});

export function matchesNode(id: string, label: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  return id === q || label.toLowerCase() === q;
}

export { ClaimSummaryV1, ReferenceV1, referenceView };
