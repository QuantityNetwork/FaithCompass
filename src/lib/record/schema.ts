/**
 * Schemas for the AbrahamMoses record.
 *
 * The record is validated against these at load time, in the test suite and
 * on the status page, so a malformed entry fails loudly instead of rendering
 * as a plausible-looking claim. The same schemas generate the JSON Schema
 * documents served at /api/v1/schema, so the published contract cannot drift
 * from what the code accepts.
 */

import { z } from 'zod/v4';
import {
  ACCEPTANCE_STANCES,
  AXIOM_ROLES,
  AXIOM_STANCES,
  CASE_RESPONSES,
  CLAIM_CLASSIFICATIONS,
  CLAIM_ROLES,
  CORPUS_CATEGORIES,
  DEPENDENCY_TYPES,
  MACHINE_INVOLVEMENT,
  MAP_KINDS,
  MAP_LINK_ROLES,
  NECESSITIES,
  PREMISE_USES,
  REVISION_STATUSES,
  TRADITION_FAMILIES,
} from './taxonomy';

export const CLAIM_CODE = /^AM-CLAIM-\d{6}$/;
export const AXIOM_CODE = /^AM-AX-\d{3}$/;
export const DERIVATION_CODE = /^AM-DRV-\d{4}$/;
export const COUNTER_CODE = /^AM-CM-\d{3}$/;
export const COVENANT_CODE = /^AM-COV-\d{4}$/;
export const DOCTRINE_CODE = /^AM-DOC-\d{4}$/;

const Text = z.string().min(1).max(4000);
const Short = z.string().min(1).max(300);
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:\d{2}))?$/);
const Slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);

/* ------------------------------------------------------------------ *
 * Corpus
 * ------------------------------------------------------------------ */

export const EditionSchema = z.object({
  id: Slug,
  title: Text,
  publisher: z.string().max(300).nullable(),
  year: z.string().max(40).nullable(),
  language: Short,
});
export type Edition = z.infer<typeof EditionSchema>;

export const WorkSchema = z.object({
  id: Slug,
  title: Short,
  /** Prefix used when a locator is cited, e.g. "Hebrews", "Q", "b. Bava Metzia". */
  citeAs: Short,
  aliases: z.array(Short),
  category: z.enum(CORPUS_CATEGORIES),
  /** Group shown on the coverage page, e.g. "Tanakh", "Babylonian Talmud". */
  collection: Short,
  /** Families that hold the work as scripture; empty for non-canonical works. */
  canonicalFor: z.array(z.enum(TRADITION_FAMILIES)),
  edition: EditionSchema,
  author: z.string().max(300).nullable(),
  date: z.string().max(120).nullable(),
});
export type Work = z.infer<typeof WorkSchema>;

export const TranslationSchema = z.object({
  id: Slug,
  name: Short,
  publisher: z.string().max(300).nullable(),
  year: z.string().max(40).nullable(),
  license: Text,
  /** Whether quotations attributed to this translation have been checked by an editor. */
  verified: z.boolean(),
});
export type Translation = z.infer<typeof TranslationSchema>;

export const ReferenceSchema = z.object({
  work: Slug,
  /** Chapter, verse, folio or section within the work. Empty for a whole work. */
  locator: z.string().max(120),
  display: Short,
});
export type Reference = z.infer<typeof ReferenceSchema>;

/* ------------------------------------------------------------------ *
 * Traditions and axioms
 * ------------------------------------------------------------------ */

export const TraditionSchema = z.object({
  id: Slug,
  name: Short,
  family: z.enum(TRADITION_FAMILIES),
  description: Text,
  /** Texts the tradition treats as authoritative, in its own terms. */
  authorities: Text,
  /** Categories the tradition uses natively, so it is not read through another's. */
  nativeCategories: z.array(Short),
});
export type Tradition = z.infer<typeof TraditionSchema>;

export const AxiomStanceSchema = z.object({
  tradition: Slug,
  stance: z.enum(AXIOM_STANCES),
  note: z.string().max(1000).nullable(),
  references: z.array(ReferenceSchema),
});

export const AxiomSchema = z.object({
  code: z.string().regex(AXIOM_CODE),
  label: Short,
  statement: Text,
  rationale: Text,
  /** Who formulates the principle — shown as attribution, never as endorsement. */
  heldBy: Short,
  stances: z.array(AxiomStanceSchema),
  /** Tradition stances are reviewed separately from the axiom's own wording. */
  stancesStatus: z.enum(REVISION_STATUSES),
  firstPublished: IsoDate,
  status: z.enum(REVISION_STATUSES),
});
export type Axiom = z.infer<typeof AxiomSchema>;

/* ------------------------------------------------------------------ *
 * Claims
 * ------------------------------------------------------------------ */

export const QuotationSchema = z.object({
  text: Text,
  reference: ReferenceSchema,
  translation: Slug.nullable(),
});

export const VariantSchema = z.object({
  reference: ReferenceSchema,
  description: Text,
  bearing: z.enum(['none', 'minor', 'material']),
});

export const AxisValueSchema = z.object({
  level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).nullable(),
  /** Why this level — the criterion as applied to this claim. */
  basis: Text,
});

export const ConfidenceProfileSchema = z.object({
  textual: AxisValueSchema,
  philological: AxisValueSchema,
  historical: AxisValueSchema,
  inferential: AxisValueSchema,
});
export type ConfidenceProfile = z.infer<typeof ConfidenceProfileSchema>;

export const AcceptanceSchema = z.object({
  tradition: Slug,
  stance: z.enum(ACCEPTANCE_STANCES),
  note: z.string().max(1000).nullable(),
  references: z.array(ReferenceSchema),
});
export type Acceptance = z.infer<typeof AcceptanceSchema>;

export const AttributionSchema = z.object({
  kind: z.enum(['textual_report', 'tradition', 'scholarship']),
  traditions: z.array(Slug),
  note: z.string().max(1000).nullable(),
});

export const EditorialSchema = z.object({
  author: Short,
  reviewers: z.array(
    z.object({ name: Short, role: Short, affiliation: z.string().max(300).nullable(), date: IsoDate }),
  ),
  changeNote: Text,
});

export const MachineSchema = z.object({
  level: z.enum(MACHINE_INVOLVEMENT),
  description: Text,
  verification: z.enum(['verified', 'pending', 'not_applicable']),
});

export const ProvenanceNoteSchema = z.object({ label: Short, detail: Text });

export const ClaimRevisionSchema = z.object({
  rev: z.number().int().positive(),
  status: z.enum(REVISION_STATUSES),
  publishedAt: IsoDate,
  statement: Text,
  classification: z.enum(CLAIM_CLASSIFICATIONS),
  /** The heading label the record has used for this claim since rev 1 (kept for API compatibility). */
  headlineConfidence: z.enum(['Very high', 'High', 'Moderate', 'Low', 'Very low']),
  disputed: Short,
  interpretiveDivergence: Text,
  primaryWitnesses: z.array(ReferenceSchema).min(1),
  evidence: z.array(z.object({ reference: ReferenceSchema, note: z.string().max(1000).nullable() })),
  quotations: z.array(QuotationSchema),
  variants: z.array(VariantSchema),
  confidence: ConfidenceProfileSchema.nullable(),
  acceptance: z.array(AcceptanceSchema),
  attribution: AttributionSchema,
  /** Provenance chain as authored for this revision; generated from structure when absent. */
  provenanceNotes: z.array(ProvenanceNoteSchema),
  editorial: EditorialSchema,
  machine: MachineSchema,
});
export type ClaimRevision = z.infer<typeof ClaimRevisionSchema>;

export const ClaimSchema = z.object({
  code: z.string().regex(CLAIM_CODE),
  role: z.enum(CLAIM_ROLES),
  topic: Short,
  /** Research cases the claim belongs to. */
  cases: z.array(Slug),
  /** Append-only. Revision n+1 never edits revision n; tests pin every public revision's hash. */
  revisions: z.array(ClaimRevisionSchema).min(1),
});
export type Claim = z.infer<typeof ClaimSchema>;

/* ------------------------------------------------------------------ *
 * Derivations — the AND/OR structure of the dependency model
 * ------------------------------------------------------------------ */

export const PremiseSchema = z.object({
  claim: z.string().regex(CLAIM_CODE),
  necessity: z.enum(NECESSITIES),
  type: z.enum(DEPENDENCY_TYPES),
  use: z.enum(PREMISE_USES),
  rationale: Text,
});
export type Premise = z.infer<typeof PremiseSchema>;

export const DerivationAxiomSchema = z.object({
  axiom: z.string().regex(AXIOM_CODE),
  role: z.enum(AXIOM_ROLES),
  note: z.string().max(1000).nullable(),
});

/**
 * One way of arriving at a claim.
 *
 * A claim with several derivations holds while any one of them holds (OR).
 * Within a derivation every necessary premise and every required axiom must
 * hold (AND); supporting premises and strengthening axioms only weaken it when
 * they fail.
 */
export const DerivationSchema = z.object({
  code: z.string().regex(DERIVATION_CODE),
  claim: z.string().regex(CLAIM_CODE),
  label: Short,
  summary: Text,
  premises: z.array(PremiseSchema),
  axioms: z.array(DerivationAxiomSchema),
  since: IsoDate,
});
export type Derivation = z.infer<typeof DerivationSchema>;

export const CounterModelSchema = z.object({
  code: z.string().regex(COUNTER_CODE),
  title: Short,
  heldBy: Short,
  traditions: z.array(Slug),
  thesis: Text,
  alternativeReading: Text,
  evidence: z.array(ReferenceSchema),
  strength: z.enum(['strong', 'moderate', 'minority']),
  /** The claim this reading contests. */
  targets: z.string().regex(CLAIM_CODE),
  /** Axioms the counter-reading itself depends on. */
  reliesOn: z.array(z.string().regex(AXIOM_CODE)),
  /** Axioms the counter-reading denies. */
  rejects: z.array(z.string().regex(AXIOM_CODE)),
  /** When the reading is also recorded as a position claim. */
  position: z.string().regex(CLAIM_CODE).nullable(),
  status: z.enum(REVISION_STATUSES),
  firstPublished: IsoDate,
});
export type CounterModel = z.infer<typeof CounterModelSchema>;

/* ------------------------------------------------------------------ *
 * Covenant Map and Doctrine Graph
 * ------------------------------------------------------------------ */

export const CovenantNodeSchema = z.object({
  id: Slug,
  label: Short,
  /** Narrative order, used for layout only. */
  order: z.number(),
  families: z.array(z.enum(TRADITION_FAMILIES)),
  summary: Text,
});
export type CovenantNode = z.infer<typeof CovenantNodeSchema>;

export const CovenantEdgeSchema = z.object({
  code: z.string().regex(COVENANT_CODE),
  covenantName: Short,
  relationshipType: Short,
  source: Slug,
  target: Slug,
  description: Text,
  evidence: z.array(ReferenceSchema),
  confidence: z.enum(['Very high', 'High', 'Medium', 'Interpretive']),
  /** Whose reading of covenantal history the edge belongs to. */
  readings: z.array(z.enum(TRADITION_FAMILIES)),
  updatedAt: IsoDate,
  status: z.enum(REVISION_STATUSES),
});
export type CovenantEdge = z.infer<typeof CovenantEdgeSchema>;

export const DoctrineNodeSchema = z.object({
  id: Slug,
  label: Short,
  aka: z.array(Short),
  families: z.array(z.enum(TRADITION_FAMILIES)),
});
export type DoctrineNode = z.infer<typeof DoctrineNodeSchema>;

export const DoctrineEdgeSchema = z.object({
  code: z.string().regex(DOCTRINE_CODE),
  source: Slug,
  target: Slug,
  relationshipType: Short,
  description: Text,
  evidence: z.array(ReferenceSchema),
  classification: z.enum(['Explicit connection', 'Interpretive connection']),
  traditionStatus: Text,
  confidence: z.enum(['Very high', 'High', 'Medium']),
  topic: Short,
  families: z.array(z.enum(TRADITION_FAMILIES)),
  updatedAt: IsoDate,
  status: z.enum(REVISION_STATUSES),
});
export type DoctrineEdge = z.infer<typeof DoctrineEdgeSchema>;

export const MapLinkSchema = z.object({
  mapKind: z.enum(MAP_KINDS),
  code: z.string(),
  role: z.enum(MAP_LINK_ROLES),
  claim: z.string().regex(CLAIM_CODE),
  note: Text,
});
export type MapLink = z.infer<typeof MapLinkSchema>;

/* ------------------------------------------------------------------ *
 * Research cases
 * ------------------------------------------------------------------ */

export const CasePositionSchema = z.object({
  claim: z.string().regex(CLAIM_CODE),
  label: Short,
  heldBy: z.array(Slug),
});

export const CaseResponseSchema = z.object({
  tradition: Slug,
  response: z.enum(CASE_RESPONSES),
  summary: Text,
  /** The tradition's own terms for the material. */
  categories: z.array(Short),
  position: z.string().regex(CLAIM_CODE).nullable(),
  references: z.array(ReferenceSchema),
});
export type CaseResponse = z.infer<typeof CaseResponseSchema>;

export const ResearchCaseSchema = z.object({
  slug: Slug,
  field: z.enum(['jewish-studies', 'christian-studies', 'islamic-studies', 'latter-day-saint-studies']),
  title: Short,
  question: Short,
  summary: Text,
  /** Why the question is asked this way, and whose categories it uses. */
  framing: Text,
  aliases: z.array(Short),
  positions: z.array(CasePositionSchema).min(2),
  /** The two positions shown side by side when the case opens. */
  featured: z.tuple([z.string().regex(CLAIM_CODE), z.string().regex(CLAIM_CODE)]),
  /** The disputed assumption the guided walkthrough suggests rejecting first. */
  suggestedRejection: z.string().regex(AXIOM_CODE),
  responses: z.array(CaseResponseSchema).min(3),
  limitations: z.array(Text),
  status: z.enum(REVISION_STATUSES),
  firstPublished: IsoDate,
});
export type ResearchCase = z.infer<typeof ResearchCaseSchema>;

/* ------------------------------------------------------------------ *
 * The whole record
 * ------------------------------------------------------------------ */

export const RecordSchema = z.object({
  works: z.array(WorkSchema),
  translations: z.array(TranslationSchema),
  traditions: z.array(TraditionSchema),
  axioms: z.array(AxiomSchema),
  claims: z.array(ClaimSchema),
  derivations: z.array(DerivationSchema),
  counterModels: z.array(CounterModelSchema),
  covenantNodes: z.array(CovenantNodeSchema),
  covenants: z.array(CovenantEdgeSchema),
  doctrineNodes: z.array(DoctrineNodeSchema),
  doctrine: z.array(DoctrineEdgeSchema),
  mapLinks: z.array(MapLinkSchema),
  cases: z.array(ResearchCaseSchema),
});
export type RecordData = z.infer<typeof RecordSchema>;
