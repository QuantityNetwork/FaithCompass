/**
 * Public representations of the record (API v1).
 *
 * Each view has a Zod schema and a builder. The schemas are the published
 * contract: they generate the JSON Schemas at /api/v1/schema, the OpenAPI
 * document and the MCP tools' output schemas, and the contract tests validate
 * every response against them. A field cannot appear in a response without
 * appearing in the documentation.
 */

import { z } from 'zod/v4';
import { generateProvenance, citationText } from '@/lib/record/provenance';
import type { AbrahamMosesRecord } from '@/lib/record/record';
import type { Claim, Reference } from '@/lib/record/schema';
import type { Reason, SimulationResult } from '@/lib/record/engine';
import { STATUS_DESCRIPTIONS, STATUS_LABELS, CLAIM_STATUSES } from '@/lib/record/engine';
import {
  ACCEPTANCE_STANCES,
  AXIS_META,
  CASE_RESPONSE_META,
  CLASSIFICATION_META,
  CONFIDENCE_AXES,
  FAMILY_META,
  MACHINE_META,
  REVISION_STATUSES,
  STATUS_META,
} from '@/lib/record/taxonomy';
import { absoluteUrl, canonicalOrigin } from '@/lib/site/config';

/* ------------------------------------------------------------------ *
 * Schemas
 * ------------------------------------------------------------------ */

export const ReferenceV1 = z.object({
  display: z.string(),
  work: z.string(),
  locator: z.string(),
  work_title: z.string(),
  edition: z.string(),
});

const Level = z.number().int().min(1).max(5).nullable();

export const AxisV1 = z.object({
  level: Level,
  label: z.string().nullable(),
  criterion: z.string().nullable(),
  basis: z.string(),
});

export const ConfidenceV1 = z.object({
  textual: AxisV1,
  philological: AxisV1,
  historical: AxisV1,
  inferential: AxisV1,
});

export const AcceptanceV1 = z.object({
  tradition: z.string(),
  tradition_name: z.string(),
  family: z.string(),
  stance: z.enum(ACCEPTANCE_STANCES),
  note: z.string().nullable(),
});

const Status = z.enum(REVISION_STATUSES);

export const ClaimSummaryV1 = z.object({
  object: z.literal('claim_summary'),
  code: z.string(),
  url: z.string(),
  statement: z.string(),
  role: z.string(),
  classification: z.string(),
  classification_label: z.string(),
  topic: z.string(),
  cases: z.array(z.string()),
  revision: z.number().int(),
  status: Status,
  published_at: z.string(),
  headline_confidence: z.string(),
  disputed: z.string(),
  interpretive_divergence: z.string(),
  witnesses: z.array(ReferenceV1),
});

export const PremiseV1 = z.object({
  claim: z.string(),
  statement: z.string(),
  necessity: z.string(),
  type: z.string(),
  use: z.string(),
  rationale: z.string(),
});

export const DerivationV1 = z.object({
  code: z.string(),
  claim: z.string(),
  label: z.string(),
  summary: z.string(),
  premises: z.array(PremiseV1),
  axioms: z.array(z.object({ axiom: z.string(), label: z.string(), role: z.string(), note: z.string().nullable() })),
});

export const CounterModelV1 = z.object({
  object: z.literal('counter_model'),
  code: z.string(),
  title: z.string(),
  held_by: z.string(),
  traditions: z.array(z.string()),
  thesis: z.string(),
  alternative_reading: z.string(),
  evidence: z.array(ReferenceV1),
  strength: z.string(),
  targets: z.string(),
  relies_on: z.array(z.string()),
  rejects: z.array(z.string()),
  position: z.string().nullable(),
  status: Status,
});

export const ProvenanceStepV1 = z.object({
  position: z.number().int(),
  label: z.string(),
  detail: z.string(),
  codes: z.array(z.string()),
});

export const ClaimV1 = ClaimSummaryV1.extend({
  object: z.literal('claim'),
  status_note: z.string(),
  last_verified_revision: z.number().int().nullable(),
  confidence: ConfidenceV1.nullable(),
  acceptance: z.array(AcceptanceV1),
  attribution: z.object({ kind: z.string(), traditions: z.array(z.string()), note: z.string().nullable() }),
  evidence: z.array(z.object({ reference: ReferenceV1, note: z.string().nullable() })),
  quotations: z.array(
    z.object({
      text: z.string(),
      reference: ReferenceV1,
      translation: z.object({ id: z.string(), name: z.string(), license: z.string(), verified: z.boolean() }).nullable(),
    }),
  ),
  variants: z.array(z.object({ reference: ReferenceV1, description: z.string(), bearing: z.string() })),
  editions: z.array(
    z.object({
      work: z.string(),
      work_title: z.string(),
      edition: z.string(),
      publisher: z.string().nullable(),
      year: z.string().nullable(),
      language: z.string(),
    }),
  ),
  derivations: z.array(DerivationV1),
  grounded_in_witness: z.boolean(),
  supports: z.array(z.string()),
  counter_models: z.array(CounterModelV1),
  map_links: z.array(z.object({ map_kind: z.string(), code: z.string(), role: z.string(), note: z.string() })),
  provenance: z.array(ProvenanceStepV1),
  editorial: z.object({
    author: z.string(),
    reviewers: z.array(z.object({ name: z.string(), role: z.string(), affiliation: z.string().nullable(), date: z.string() })),
    change_note: z.string(),
  }),
  machine_involvement: z.object({ level: z.string(), label: z.string(), description: z.string(), verification: z.string() }),
  revisions: z.array(z.object({ rev: z.number().int(), status: Status, published_at: z.string(), change_note: z.string(), url: z.string() })),
  citation: z.object({ text: z.string(), url: z.string() }),
});

export const AxiomV1 = z.object({
  object: z.literal('axiom'),
  code: z.string(),
  label: z.string(),
  statement: z.string(),
  rationale: z.string(),
  held_by: z.string(),
  status: Status,
  stances_status: Status,
  stances: z.array(z.object({ tradition: z.string(), tradition_name: z.string(), stance: z.string(), note: z.string().nullable() })),
  used_by: z.array(z.object({ claim: z.string(), derivation: z.string(), role: z.string() })),
});

export const CovenantV1 = z.object({
  object: z.literal('covenant_relationship'),
  code: z.string(),
  covenant_name: z.string(),
  relationship_type: z.string(),
  source: z.string(),
  source_label: z.string(),
  target: z.string(),
  target_label: z.string(),
  description: z.string(),
  evidence: z.array(ReferenceV1),
  confidence: z.string(),
  readings: z.array(z.string()),
  status: Status,
  updated_at: z.string(),
  grounded_by: z.array(z.string()),
  illustrated_by: z.array(z.string()),
});

export const DoctrineV1 = z.object({
  object: z.literal('doctrine_connection'),
  code: z.string(),
  source: z.string(),
  source_label: z.string(),
  target: z.string(),
  target_label: z.string(),
  relationship_type: z.string(),
  description: z.string(),
  evidence: z.array(ReferenceV1),
  classification: z.string(),
  tradition_status: z.string(),
  confidence: z.string(),
  topic: z.string(),
  families: z.array(z.string()),
  status: Status,
  updated_at: z.string(),
  grounded_by: z.array(z.string()),
  illustrated_by: z.array(z.string()),
});

export const TraditionV1 = z.object({
  object: z.literal('tradition'),
  id: z.string(),
  name: z.string(),
  family: z.string(),
  family_label: z.string(),
  description: z.string(),
  authorities: z.string(),
  native_categories: z.array(z.string()),
  axiom_stances: z.array(z.object({ axiom: z.string(), label: z.string(), stance: z.string(), note: z.string().nullable() })),
});

export const CaseV1 = z.object({
  object: z.literal('research_case'),
  slug: z.string(),
  url: z.string(),
  field: z.string(),
  title: z.string(),
  question: z.string(),
  summary: z.string(),
  framing: z.string(),
  status: Status,
  positions: z.array(z.object({ claim: z.string(), label: z.string(), held_by: z.array(z.string()), statement: z.string() })),
  featured: z.array(z.string()),
  suggested_rejection: z.string(),
  responses: z.array(
    z.object({
      tradition: z.string(),
      tradition_name: z.string(),
      response: z.string(),
      response_label: z.string(),
      summary: z.string(),
      categories: z.array(z.string()),
      position: z.string().nullable(),
      references: z.array(ReferenceV1),
    }),
  ),
  limitations: z.array(z.string()),
  claims: z.array(z.string()),
});

export const ReasonV1 = z.object({
  kind: z.string(),
  explanation: z.string(),
  derivation: z.string().optional(),
  premise: z.string().optional(),
  axiom: z.string().optional(),
});

export const SimulationV1 = z.object({
  object: z.literal('simulation'),
  record_version: z.string(),
  notice: z.string(),
  input: z.object({ reject_claims: z.array(z.string()), reject_axioms: z.array(z.string()), lens: z.string().nullable() }),
  effective_axioms: z.array(z.string()),
  summary: z.object({
    stands: z.number().int(),
    weakened: z.number().int(),
    unwarranted: z.number().int(),
    broken: z.number().int(),
    rejected: z.number().int(),
    map_edges_ungrounded: z.number().int(),
    map_edges_weakened: z.number().int(),
  }),
  affected: z.array(
    z.object({
      code: z.string(),
      statement: z.string(),
      status: z.enum(CLAIM_STATUSES),
      status_label: z.string(),
      status_description: z.string(),
      depth: z.number().int(),
      via: z.array(z.string()),
      reasons: z.array(ReasonV1),
    }),
  ),
  derivations: z.array(z.object({ code: z.string(), claim: z.string(), valid: z.boolean(), valid_at_baseline: z.boolean() })),
  map_edges: z.array(
    z.object({ map_kind: z.string(), code: z.string(), status: z.string(), grounded_by: z.array(z.string()), affected_links: z.array(z.string()) }),
  ),
  counter_models: z.array(
    z.object({ code: z.string(), title: z.string(), status: z.string(), aligned_with: z.array(z.string()), undermined_by: z.array(z.string()) }),
  ),
});

export const SearchV1 = z.object({
  object: z.literal('search_results'),
  query: z.string(),
  record_version: z.string(),
  generated_text: z.literal(false),
  guardrail: z.object({ kind: z.string(), message: z.string(), suggested_questions: z.array(z.string()) }).nullable(),
  references: z.array(z.object({ display: z.string(), work: z.string() })),
  research_case: z.object({ slug: z.string(), title: z.string(), question: z.string(), url: z.string() }).nullable(),
  claims: z.array(ClaimSummaryV1.extend({ score: z.number(), matched: z.array(z.string()) })),
  other: z.array(z.object({ kind: z.string(), code: z.string(), score: z.number() })),
});

export const ProvenanceV1 = z.object({
  object: z.literal('provenance_chain'),
  claim: z.object({ code: z.string(), statement: z.string(), revision: z.number().int() }),
  steps: z.array(ProvenanceStepV1),
});

export const CitationV1 = z.object({
  object: z.literal('citation'),
  code: z.string(),
  revision: z.number().int(),
  text: z.string(),
  bibtex: z.string(),
  csl: z.record(z.string(), z.unknown()),
});

export const ErrorV1 = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    status: z.number().int(),
    details: z.unknown().optional(),
    docs: z.string(),
  }),
});

export function listOf<T extends z.ZodType>(item: T) {
  return z.object({
    object: z.literal('list'),
    data: z.array(item),
    total: z.number().int(),
    limit: z.number().int(),
    offset: z.number().int(),
    record_version: z.string(),
  });
}

/* ------------------------------------------------------------------ *
 * Builders
 * ------------------------------------------------------------------ */

type R = AbrahamMosesRecord;

export function referenceView(record: R, ref: Reference): z.infer<typeof ReferenceV1> {
  const work = record.work(ref.work);
  return {
    display: ref.display,
    work: ref.work,
    locator: ref.locator,
    work_title: work?.title ?? ref.work,
    edition: work?.edition.title ?? 'Unknown edition',
  };
}

export const claimUrl = (code: string, rev?: number) => absoluteUrl(`/claims/${code}${rev ? `?rev=${rev}` : ''}`);

export function claimSummary(record: R, claim: Claim, rev?: number): z.infer<typeof ClaimSummaryV1> {
  const r = (rev && record.revision(claim, rev)) || record.current(claim);
  return {
    object: 'claim_summary',
    code: claim.code,
    url: claimUrl(claim.code),
    statement: r.statement,
    role: claim.role,
    classification: r.classification,
    classification_label: CLASSIFICATION_META[r.classification].label,
    topic: claim.topic,
    cases: claim.cases,
    revision: r.rev,
    status: r.status,
    published_at: r.publishedAt,
    headline_confidence: r.headlineConfidence,
    disputed: r.disputed,
    interpretive_divergence: r.interpretiveDivergence,
    witnesses: r.primaryWitnesses.map((w) => referenceView(record, w)),
  };
}

export function counterModelView(record: R, code: string): z.infer<typeof CounterModelV1> {
  const m = record.counterModel(code)!;
  return {
    object: 'counter_model',
    code: m.code,
    title: m.title,
    held_by: m.heldBy,
    traditions: m.traditions,
    thesis: m.thesis,
    alternative_reading: m.alternativeReading,
    evidence: m.evidence.map((e) => referenceView(record, e)),
    strength: m.strength,
    targets: m.targets,
    relies_on: m.reliesOn,
    rejects: m.rejects,
    position: m.position,
    status: m.status,
  };
}

export function derivationView(record: R, code: string): z.infer<typeof DerivationV1> {
  const d = record.data.derivations.find((x) => x.code === code)!;
  return {
    code: d.code,
    claim: d.claim,
    label: d.label,
    summary: d.summary,
    premises: d.premises.map((p) => ({
      claim: p.claim,
      statement: record.current(record.claim(p.claim)!).statement,
      necessity: p.necessity,
      type: p.type,
      use: p.use,
      rationale: p.rationale,
    })),
    axioms: d.axioms.map((a) => ({ axiom: a.axiom, label: record.axiom(a.axiom)!.label, role: a.role, note: a.note })),
  };
}

export function claimView(record: R, claim: Claim, rev?: number): z.infer<typeof ClaimV1> {
  const r = (rev && record.revision(claim, rev)) || record.current(claim);
  const lastVerified = record.lastVerified(claim);
  const tradition = (id: string) => record.tradition(id);
  const editions = new Map<string, z.infer<typeof ClaimV1>['editions'][number]>();
  for (const w of r.primaryWitnesses) {
    const work = record.work(w.work);
    if (work && !editions.has(work.id)) {
      editions.set(work.id, {
        work: work.id,
        work_title: work.title,
        edition: work.edition.title,
        publisher: work.edition.publisher,
        year: work.edition.year,
        language: work.edition.language,
      });
    }
  }
  const axis = (key: (typeof CONFIDENCE_AXES)[number]) => {
    const v = r.confidence![key];
    return {
      level: v.level,
      label: v.level ? AXIS_META[key].levels[v.level].label : null,
      criterion: v.level ? AXIS_META[key].levels[v.level].criterion : null,
      basis: v.basis,
    };
  };

  return {
    ...claimSummary(record, claim, r.rev),
    object: 'claim',
    status_note: STATUS_META[r.status].definition,
    last_verified_revision: lastVerified?.rev ?? null,
    confidence: r.confidence
      ? { textual: axis('textual'), philological: axis('philological'), historical: axis('historical'), inferential: axis('inferential') }
      : null,
    acceptance: r.acceptance.map((a) => ({
      tradition: a.tradition,
      tradition_name: tradition(a.tradition)?.name ?? a.tradition,
      family: tradition(a.tradition)?.family ?? 'unknown',
      stance: a.stance,
      note: a.note,
    })),
    attribution: r.attribution,
    evidence: r.evidence.map((e) => ({ reference: referenceView(record, e.reference), note: e.note })),
    quotations: r.quotations.map((q) => {
      const t = q.translation ? record.data.translations.find((x) => x.id === q.translation) : undefined;
      return {
        text: q.text,
        reference: referenceView(record, q.reference),
        translation: t ? { id: t.id, name: t.name, license: t.license, verified: t.verified } : null,
      };
    }),
    variants: r.variants.map((v) => ({ reference: referenceView(record, v.reference), description: v.description, bearing: v.bearing })),
    editions: [...editions.values()],
    derivations: record.derivationsOf(claim.code).map((d) => derivationView(record, d.code)),
    grounded_in_witness: CLASSIFICATION_META[r.classification].grounding !== 'derived',
    supports: [...new Set(record.dependentsOf(claim.code).map((d) => d.claim))].sort(),
    counter_models: record.counterModelsFor(claim.code).map((m) => counterModelView(record, m.code)),
    map_links: record.mapLinksFor(claim.code).map((l) => ({ map_kind: l.mapKind, code: l.code, role: l.role, note: l.note })),
    provenance: generateProvenance(record, claim, r.rev),
    editorial: {
      author: r.editorial.author,
      reviewers: r.editorial.reviewers,
      change_note: r.editorial.changeNote,
    },
    machine_involvement: {
      level: r.machine.level,
      label: MACHINE_META[r.machine.level].label,
      description: r.machine.description,
      verification: r.machine.verification,
    },
    revisions: claim.revisions.map((x) => ({
      rev: x.rev,
      status: x.status,
      published_at: x.publishedAt,
      change_note: x.editorial.changeNote,
      url: claimUrl(claim.code, x.rev),
    })),
    citation: { text: citationText(record, claim, r.rev, canonicalOrigin()), url: claimUrl(claim.code, r.rev) },
  };
}

export function axiomView(record: R, code: string): z.infer<typeof AxiomV1> {
  const a = record.axiom(code)!;
  return {
    object: 'axiom',
    code: a.code,
    label: a.label,
    statement: a.statement,
    rationale: a.rationale,
    held_by: a.heldBy,
    status: a.status,
    stances_status: a.stancesStatus,
    stances: a.stances.map((s) => ({
      tradition: s.tradition,
      tradition_name: record.tradition(s.tradition)?.name ?? s.tradition,
      stance: s.stance,
      note: s.note,
    })),
    used_by: record.data.derivations.flatMap((d) =>
      d.axioms.filter((x) => x.axiom === a.code).map((x) => ({ claim: d.claim, derivation: d.code, role: x.role })),
    ),
  };
}

function linksFor(record: R, mapKind: 'covenant' | 'doctrine', code: string) {
  const links = record.data.mapLinks.filter((l) => l.mapKind === mapKind && l.code === code);
  return {
    grounded_by: links.filter((l) => l.role === 'grounds').map((l) => l.claim),
    illustrated_by: links.filter((l) => l.role === 'illustrates').map((l) => l.claim),
  };
}

export function covenantView(record: R, code: string): z.infer<typeof CovenantV1> {
  const e = record.covenantEdge(code)!;
  const node = (id: string) => record.data.covenantNodes.find((n) => n.id === id)!.label;
  return {
    object: 'covenant_relationship',
    code: e.code,
    covenant_name: e.covenantName,
    relationship_type: e.relationshipType,
    source: e.source,
    source_label: node(e.source),
    target: e.target,
    target_label: node(e.target),
    description: e.description,
    evidence: e.evidence.map((x) => referenceView(record, x)),
    confidence: e.confidence,
    readings: e.readings,
    status: e.status,
    updated_at: e.updatedAt,
    ...linksFor(record, 'covenant', e.code),
  };
}

export function doctrineView(record: R, code: string): z.infer<typeof DoctrineV1> {
  const e = record.doctrineEdge(code)!;
  const node = (id: string) => record.data.doctrineNodes.find((n) => n.id === id)!.label;
  return {
    object: 'doctrine_connection',
    code: e.code,
    source: e.source,
    source_label: node(e.source),
    target: e.target,
    target_label: node(e.target),
    relationship_type: e.relationshipType,
    description: e.description,
    evidence: e.evidence.map((x) => referenceView(record, x)),
    classification: e.classification,
    tradition_status: e.traditionStatus,
    confidence: e.confidence,
    topic: e.topic,
    families: e.families,
    status: e.status,
    updated_at: e.updatedAt,
    ...linksFor(record, 'doctrine', e.code),
  };
}

export function traditionView(record: R, id: string): z.infer<typeof TraditionV1> {
  const t = record.tradition(id)!;
  return {
    object: 'tradition',
    id: t.id,
    name: t.name,
    family: t.family,
    family_label: FAMILY_META[t.family].label,
    description: t.description,
    authorities: t.authorities,
    native_categories: t.nativeCategories,
    axiom_stances: record.data.axioms.flatMap((a) =>
      a.stances.filter((s) => s.tradition === id).map((s) => ({ axiom: a.code, label: a.label, stance: s.stance, note: s.note })),
    ),
  };
}

export function caseView(record: R, slug: string): z.infer<typeof CaseV1> {
  const rc = record.researchCase(slug)!;
  return {
    object: 'research_case',
    slug: rc.slug,
    url: absoluteUrl(`/research/${rc.slug}`),
    field: rc.field,
    title: rc.title,
    question: rc.question,
    summary: rc.summary,
    framing: rc.framing,
    status: rc.status,
    positions: rc.positions.map((p) => ({
      claim: p.claim,
      label: p.label,
      held_by: p.heldBy,
      statement: record.current(record.claim(p.claim)!).statement,
    })),
    featured: [...rc.featured],
    suggested_rejection: rc.suggestedRejection,
    responses: rc.responses.map((x) => ({
      tradition: x.tradition,
      tradition_name: record.tradition(x.tradition)?.name ?? x.tradition,
      response: x.response,
      response_label: CASE_RESPONSE_META[x.response].label,
      summary: x.summary,
      categories: x.categories,
      position: x.position,
      references: x.references.map((r) => referenceView(record, r)),
    })),
    limitations: rc.limitations,
    claims: record.claimsInCase(rc.slug).map((c) => c.code),
  };
}

/* ------------------------------------------------------------------ *
 * Simulation
 * ------------------------------------------------------------------ */

export const SIMULATION_NOTICE =
  'Simulation only. Nothing in the record has been changed: every source, claim and revision is exactly as published. The result shows what would follow if the named claims or reading principles were rejected; rival readings are reported on both sides.';

export function explainReason(record: R, reason: Reason): z.infer<typeof ReasonV1> {
  const statement = (code: string) => `${code}`;
  const axiomLabel = (code: string) => `${code} (${record.axiom(code)?.label ?? code})`;
  switch (reason.kind) {
    case 'rejected':
      return { kind: reason.kind, explanation: 'Rejected directly in this simulation.' };
    case 'not_established_at_baseline':
      return { kind: reason.kind, explanation: 'This claim is not established even when nothing is rejected — a record defect.' };
    case 'witness_stands':
      return { kind: reason.kind, explanation: 'The cited text still says this; its standing as a report is unaffected.' };
    case 'derivation_holds':
      return { kind: reason.kind, derivation: reason.derivation, explanation: `${reason.derivation} “${reason.label}” still holds.` };
    case 'derivation_failed': {
      const why = reason.failures
        .map((f) =>
          f.kind === 'axiom_rejected'
            ? `it requires ${axiomLabel(f.axiom)}, which is rejected`
            : f.kind === 'premise_unwarranted'
              ? `it needs ${statement(f.premise)} to hold as a conclusion, and that claim has lost its warrant`
              : `its necessary premise ${statement(f.premise)} no longer holds`,
        )
        .join('; ');
      return { kind: reason.kind, derivation: reason.derivation, explanation: `${reason.derivation} “${reason.label}” fails: ${why}.` };
    }
    case 'supporting_premise_affected':
      return {
        kind: reason.kind,
        derivation: reason.derivation,
        premise: reason.premise,
        explanation: `Supporting premise ${reason.premise} is ${STATUS_LABELS[reason.premiseStatus].toLowerCase()}.`,
      };
    case 'necessary_premise_weakened':
      return {
        kind: reason.kind,
        derivation: reason.derivation,
        premise: reason.premise,
        explanation: `Necessary premise ${reason.premise} still holds but is ${STATUS_LABELS[reason.premiseStatus].toLowerCase()}.`,
      };
    case 'strengthening_axiom_rejected':
      return {
        kind: reason.kind,
        derivation: reason.derivation,
        axiom: reason.axiom,
        explanation: `${axiomLabel(reason.axiom)} strengthened ${reason.derivation} and is rejected.`,
      };
  }
}

export function simulationView(record: R, result: SimulationResult): z.infer<typeof SimulationV1> {
  return {
    object: 'simulation',
    record_version: result.recordVersion,
    notice: SIMULATION_NOTICE,
    input: { reject_claims: result.input.rejectClaims, reject_axioms: result.input.rejectAxioms, lens: result.input.lens },
    effective_axioms: result.effectiveAxioms,
    summary: {
      stands: result.summary.stands,
      weakened: result.summary.weakened,
      unwarranted: result.summary.unwarranted,
      broken: result.summary.broken,
      rejected: result.summary.rejected,
      map_edges_ungrounded: result.summary.edgesUngrounded,
      map_edges_weakened: result.summary.edgesWeakened,
    },
    affected: result.affected.map((a) => ({
      code: a.code,
      statement: record.current(record.claim(a.code)!).statement,
      status: a.status,
      status_label: STATUS_LABELS[a.status],
      status_description: STATUS_DESCRIPTIONS[a.status],
      depth: a.depth,
      via: a.via,
      reasons: a.reasons.map((r) => explainReason(record, r)),
    })),
    derivations: Object.entries(result.derivations)
      .filter(([, d]) => d.valid !== d.validAtBaseline)
      .map(([code, d]) => ({
        code,
        claim: record.data.derivations.find((x) => x.code === code)!.claim,
        valid: d.valid,
        valid_at_baseline: d.validAtBaseline,
      })),
    map_edges: result.mapEdges.map((e) => ({
      map_kind: e.mapKind,
      code: e.code,
      status: e.status,
      grounded_by: e.groundedBy,
      affected_links: e.affectedLinks.map((l) => l.claim),
    })),
    counter_models: result.counterModels
      .filter((m) => m.status !== 'unaffected')
      .map((m) => ({
        code: m.code,
        title: record.counterModel(m.code)!.title,
        status: m.status,
        aligned_with: m.alignedWith,
        undermined_by: m.underminedBy,
      })),
  };
}
