/**
 * Sagolik Decision Evidence Protocol (SDEP, working name): versioned, provider-agnostic schema for a decision's
 * evidence graph. Pure data and validation: no database, no network, no language model.
 *
 * A document is a typed graph. Nodes carry a kind (18 kinds) and edges a type (13 types). Each edge type allows
 * only certain node kinds at each end (EDGE_RULES) and says which end depends on the other, so dependency questions
 * ("every conclusion depending on this passage") have one answer whatever the edge.
 *
 * Versioning: SDEP_VERSION is semver. A reader accepts only versions it knows (SUPPORTED_VERSIONS); a change to
 * kinds, edge rules or required fields is a new version, never an edit of an old one.
 */
import { z } from 'zod';

export const SDEP_PROTOCOL = 'sdep';
export const SDEP_VERSION = '0.1.0';
export const SUPPORTED_VERSIONS = ['0.1.0'] as const;

export const NODE_KINDS = [
  'SourceDocument',
  'SourceVersion',
  'EvidenceSpan',
  'ExtractedClaim',
  'VerifiedClaim',
  'DisputedClaim',
  'Assumption',
  'Interpretation',
  'Calculation',
  'Rule',
  'Alternative',
  'Contradiction',
  'DecisionCondition',
  'Conclusion',
  'ReviewAction',
  'HumanAttestation',
  'DecisionSnapshot',
  'MonitoringSignal',
] as const;
export type NodeKind = (typeof NODE_KINDS)[number];

export const EDGE_TYPES = [
  'DerivedFrom',
  'Quotes',
  'Supports',
  'Refutes',
  'Qualifies',
  'DependsOn',
  'UsesAssumption',
  'ComputedUsing',
  'Supersedes',
  'ReviewedBy',
  'AuthorizedBy',
  'Contradicts',
  'Reopens',
] as const;
export type EdgeType = (typeof EDGE_TYPES)[number];

const CLAIMS: NodeKind[] = ['ExtractedClaim', 'VerifiedClaim', 'DisputedClaim'];
const REASONED: NodeKind[] = [...CLAIMS, 'Interpretation', 'Calculation', 'DecisionCondition', 'Conclusion', 'Alternative', 'Assumption'];
const ANY: NodeKind[] = [...NODE_KINDS];

/**
 * Meaning of each edge `from -[type]-> to`, the node kinds allowed at each end, and which end depends on the other
 * (`dependent`): 'from' when `from` is built on `to`; 'to' when `to` is built on `from`; null when the edge records a
 * relation that is not a dependency (supersession, review, contradiction, reopening).
 */
export const EDGE_RULES: Record<EdgeType, { meaning: string; from: NodeKind[]; to: NodeKind[]; dependent: 'from' | 'to' | null }> = {
  DerivedFrom: { meaning: 'from was produced from to (extraction, version of a document, snapshot of a state)', from: ['SourceVersion', 'EvidenceSpan', ...CLAIMS, 'Interpretation', 'Calculation', 'Assumption', 'DecisionSnapshot'], to: ANY, dependent: 'from' },
  Quotes: { meaning: 'the evidence span quotes this exact source version', from: ['EvidenceSpan'], to: ['SourceVersion'], dependent: 'from' },
  Supports: { meaning: 'from is evidence for the claim or step to', from: ['EvidenceSpan', ...CLAIMS, 'Calculation', 'Interpretation'], to: REASONED, dependent: 'to' },
  Refutes: { meaning: 'from is evidence against to', from: ['EvidenceSpan', ...CLAIMS, 'Calculation', 'Interpretation'], to: REASONED, dependent: 'to' },
  Qualifies: { meaning: 'from limits the scope or strength of to without refuting it', from: ['EvidenceSpan', ...CLAIMS, 'Interpretation', 'Assumption'], to: REASONED, dependent: 'to' },
  DependsOn: { meaning: 'from holds only if to holds', from: REASONED, to: [...REASONED, 'EvidenceSpan', 'SourceVersion', 'Rule'], dependent: 'from' },
  UsesAssumption: { meaning: 'from uses the assumption to', from: ['Calculation', 'DecisionCondition', 'Conclusion', 'Interpretation', 'Alternative'], to: ['Assumption'], dependent: 'from' },
  ComputedUsing: { meaning: 'the calculation from takes to as an input', from: ['Calculation'], to: ['Calculation', 'Assumption', 'EvidenceSpan', 'VerifiedClaim', 'ExtractedClaim', 'Rule'], dependent: 'from' },
  Supersedes: { meaning: 'from replaces to; to stays as it was', from: ANY, to: ANY, dependent: null },
  ReviewedBy: { meaning: 'from was reviewed by the review action or attestation to', from: ANY, to: ['ReviewAction', 'HumanAttestation'], dependent: null },
  AuthorizedBy: { meaning: 'from (a conclusion or snapshot) was authorized by the person or action to', from: ['Conclusion', 'DecisionSnapshot', 'DecisionCondition'], to: ['HumanAttestation', 'ReviewAction'], dependent: null },
  Contradicts: { meaning: 'the contradiction from involves to', from: ['Contradiction'], to: ['EvidenceSpan', ...CLAIMS, 'Calculation', 'Interpretation', 'Assumption'], dependent: null },
  Reopens: { meaning: 'the monitoring signal from reopens to', from: ['MonitoringSignal'], to: ['Conclusion', 'DecisionCondition', 'DecisionSnapshot', 'Assumption'], dependent: null },
};

export const CONTRADICTION_CLASSES = ['CONFIRMED_CONFLICT', 'POTENTIAL_CONFLICT', 'DIFFERENT_REPORTING_BASIS', 'MISSING_EVIDENCE', 'UNRESOLVED_INTERPRETATION'] as const;
export const CONDITION_STATUSES = ['MET', 'NOT_MET', 'EVIDENCE_MISSING', 'NEEDS_HUMAN_JUDGMENT'] as const;
export const VERIFICATION_STATES = ['verified', 'unverified', 'disputed'] as const;

const Sha256 = z.string().regex(/^[0-9a-f]{64}$/, 'lowercase hex SHA-256');
const Id = z.string().min(1).max(200).regex(/^[A-Za-z0-9._:#@/-]+$/, 'id characters: A-Z a-z 0-9 . _ : # @ / -');

/** Where a span sits in its source version: character offsets, a structured field path, or a page region. */
export const LocatorSchema = z
  .discriminatedUnion('type', [
    z.object({ type: z.literal('chars'), start: z.number().int().nonnegative(), end: z.number().int().positive() }),
    z.object({ type: z.literal('field'), path: z.string().min(1) }),
    z.object({ type: z.literal('page'), page: z.number().int().positive(), region: z.string().optional() }),
  ])
  .refine((l) => l.type !== 'chars' || l.end > l.start, 'end must be after start');

/** Provenance of source material (SourceDocument, SourceVersion, EvidenceSpan). Unknown values are null, never guessed. */
export const ProvenanceSchema = z.object({
  contentSha256: Sha256.nullable(),
  version: z.string().nullable(),
  locator: LocatorSchema.nullable(),
  period: z.string().nullable(),
  unit: z.string().nullable(),
  basis: z.string().nullable(),
  extractionMethod: z.string().nullable(),
  verification: z.enum(VERIFICATION_STATES),
  permission: z.string().min(1),
  retrievedAt: z.string().nullable(),
});
export type Provenance = z.infer<typeof ProvenanceSchema>;

export const NodeSchema = z
  .object({
    id: Id,
    kind: z.enum(NODE_KINDS),
    label: z.string().min(1),
    /** Tenant that owns the node; null for public material. Edges never cross tenants. */
    tenant: z.string().nullable(),
    /** A value carried by the node (a figure, a status, a statement). */
    value: z.union([z.number(), z.string(), z.boolean(), z.null()]).optional(),
    /** For EvidenceSpan: the hash of the SourceVersion it was taken from, checked against that version. */
    sourceSha256: Sha256.optional(),
    provenance: ProvenanceSchema.optional(),
    /** For Calculation: the formula, in words or notation. */
    formula: z.string().optional(),
    /** For DecisionCondition. */
    status: z.enum(CONDITION_STATUSES).optional(),
    /** For Contradiction. */
    contradictionClass: z.enum(CONTRADICTION_CLASSES).optional(),
    /** Normalised context used to compare values (entity, measure, period, unit, basis, jurisdiction, effective date). */
    context: z.record(z.string()).optional(),
    note: z.string().optional(),
  })
  .strict();
export type SdepNode = z.infer<typeof NodeSchema>;

export const EdgeSchema = z.object({ from: Id, to: Id, type: z.enum(EDGE_TYPES), note: z.string().optional() }).strict();
export type SdepEdge = z.infer<typeof EdgeSchema>;

/** The software and rules that produced the graph, so a reader can tell which engine to replay. */
export const SoftwareSchema = z.object({
  producer: z.string().min(1),
  engine: z.object({ version: z.string(), sha256: Sha256.nullable() }).nullable(),
  ruleset: z.string().nullable(),
  model: z.object({ provider: z.string(), version: z.string() }).nullable(),
});

export const SdepDocumentSchema = z
  .object({
    protocol: z.literal(SDEP_PROTOCOL),
    version: z.enum(SUPPORTED_VERSIONS),
    id: Id,
    question: z.string().min(1),
    createdAt: z.string(),
    software: SoftwareSchema,
    nodes: z.array(NodeSchema),
    edges: z.array(EdgeSchema),
  })
  .strict();
export type SdepDocument = z.infer<typeof SdepDocumentSchema>;

/** The 14 questions SDEP answers. `answerCoverage` in integrity.ts decides, per document, which are answered. */
export const SDEP_QUESTIONS = [
  { id: 'Q1', question: 'What question was decided?' },
  { id: 'Q2', question: 'What information was used?' },
  { id: 'Q3', question: 'Where did each piece of information come from?' },
  { id: 'Q4', question: 'Which claims are supported, and which are disputed?' },
  { id: 'Q5', question: 'Which assumptions were made?' },
  { id: 'Q6', question: 'Which calculations were run?' },
  { id: 'Q7', question: 'Which alternatives were considered?' },
  { id: 'Q8', question: 'How sensitive is the result to its assumptions?' },
  { id: 'Q9', question: 'What remains unresolved?' },
  { id: 'Q10', question: 'Who authorized the decision?' },
  { id: 'Q11', question: 'What exactly was approved?' },
  { id: 'Q12', question: 'Which software and rules produced it?' },
  { id: 'Q13', question: 'Can it be checked externally?' },
  { id: 'Q14', question: 'What would reopen it?' },
] as const;
export type QuestionId = (typeof SDEP_QUESTIONS)[number]['id'];
