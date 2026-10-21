/**
 * Frozen builder for Deep Analysis Decision Passports (am-da-passport-1.0.0).
 *
 * Builds the content of a passport bundle (schema 1.0.0, docs/DECISION_PASSPORT_SPEC.md §5b) for one passport draft of
 * a private workspace: the sealed Deep Analysis report it is bound to (by hash), the engine and model that produced
 * the report, the findings with their hash-anchored spans, the two-person review, the policy version and the
 * draft's audit trail. The source hash of this directory is pinned in src/lib/decision/engines (key
 * 'deep-analysis-passport-1.0.0') and in the verifiers' engines.json. Never edit this file; add a v2 directory instead.
 *
 * Pure: no I/O, no clock. The same inputs give the same bytes.
 */
import { canonicalJson, sha256 } from '../../../decision/canonical';

export const RECORD_ENGINE_VERSION = 'am-da-passport-1.0.0';
export const RULESET = 'am-passport-issuance/1';
export const FORMAT = 'deep-analysis-passport/1';
export const REVIEW_RULE =
  'Two-person rule: a passport draft is proposed by one workspace member and approved or rejected by a different member holding the workspace role editor. Only an approved draft can be issued, and only the server signs it.';
export const ATTESTS = [
  'The bound Deep Analysis report (identified by its SHA-256 seal) existed in this form when the draft was created.',
  'Each finding listed here cites spans whose quotes hash to the recorded SHA-256 values.',
  'The analysis engine, the AI model and prompt version (if any) and the passport policy version that applied.',
  'Who proposed and who reviewed the passport (account ids; email addresses only with consent) and when.',
  'That the review followed the two-person rule, and the order of events in the audit trail.',
];
export const DOES_NOT_ATTEST = [
  'That the findings, the rating or any conclusion are legally or factually correct.',
  'That the document is complete, authentic or binding, or that any party agreed to it.',
  'Legal validity, a qualified electronic signature, certification or approval by any authority.',
  'The identity of a person beyond the sign-in account (no identity proofing).',
];

const digest = (v: unknown) => sha256(canonicalJson(v));

export interface BoundSpan {
  id: string;
  start: number;
  end: number;
  sha256: string;
  quote: string;
}

export interface BoundFinding {
  id: string;
  section: string;
  layer: string;
  title: string;
  detail: string;
  severity: string | null;
  requiresHumanReview: boolean;
  spans: string[];
  absence: { searched: string; textSha256: string } | null;
}

/** What a draft is bound to: taken from a sealed Deep Analysis report when the draft is created. */
export interface Binding {
  title: string;
  reportSha256: string;
  reportSchema: string;
  analysedAt: string;
  document: {
    filename: string | null;
    format: string;
    bytes: number;
    fileSha256: string;
    textSha256: string;
    chars: number;
    pages: number | null;
    extraction: string;
  };
  analysisEngine: {
    version: string;
    ai: { status: string; provider: string | null; model: string | null; promptVersion: string | null };
  };
  outcome: {
    rating: string;
    confidence: string;
    overall: string;
    overallSpans: string[];
    recommendedActions: { text: string; spans: string[] }[];
  };
  findings: BoundFinding[];
  spans: BoundSpan[];
}

export interface Person {
  uid: string;
  email: string | null;
  /** Consent to show the email address in the passport. Without it the email is withheld. */
  showEmail: boolean;
}

export interface RecordDraft {
  id: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'issued';
  binding: Binding;
  proposer: Person;
  createdAt: string;
  submittedAt: string | null;
  reviewer: Person | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  issuedAt: string | null;
  supersedes: string | null;
}

export interface RecordAuditEvent {
  id: string;
  changeType: string;
  entityType: string;
  entityId: string;
  actorId: string;
  at: string;
  detail: string;
}

export interface RecordEngine {
  version: string;
  sha256: string;
  source: string;
}

export interface Policy {
  version: string;
  sha256: string;
}

export interface RecordInput {
  tenant: string;
  draft: RecordDraft;
  audit: RecordAuditEvent[];
  engine: RecordEngine;
  policy: Policy;
}

/** The passport time: the issue time once issued, otherwise the time of the last lifecycle step. */
export function recordTime(d: RecordDraft): string {
  if (d.status === 'issued' && d.issuedAt) return d.issuedAt;
  return d.reviewedAt ?? d.submittedAt ?? d.createdAt;
}

export function recordState(input: RecordInput) {
  const d = input.draft;
  return { v: 'P1', k: 'deep-analysis-passport', tenant: input.tenant, d: d.id, s: d.status, t: recordTime(d), a: {} as Record<string, never> };
}

const person = (p: Person | null, role: 'proposer' | 'editor') => (p ? { role, uid: p.uid, email: p.showEmail ? p.email : null } : null);

export function buildRecord(baseId: string, input: RecordInput) {
  const d = input.draft;
  const b = d.binding;
  const state = recordState(input);
  const source = {
    id: 'report',
    kind: 'deep-analysis-report',
    title: b.title,
    report_sha256: b.reportSha256,
    report_schema: b.reportSchema,
    filename: b.document.filename,
    format: b.document.format,
    bytes: b.document.bytes,
    file_sha256: b.document.fileSha256,
    text_sha256: b.document.textSha256,
    chars: b.document.chars,
    pages: b.document.pages,
    extraction: b.document.extraction,
    analysed_at: b.analysedAt,
  };
  const inventory = [{ id: source.id, title: b.title, filename: b.document.filename, text_sha256: b.document.textSha256, sha256: digest(source) }];
  const cited = new Set([...b.findings.flatMap((f) => f.spans), ...b.outcome.overallSpans, ...b.outcome.recommendedActions.flatMap((a) => a.spans)]);
  const spans = b.spans
    .filter((s) => cited.has(s.id))
    .sort((x, y) => x.start - y.start || x.end - y.end || (x.id < y.id ? -1 : 1))
    .map((s) => ({ id: s.id, start: s.start, end: s.end, sha256: s.sha256, quote: s.quote }));
  const findings = b.findings.map((f) => ({
    id: f.id,
    section: f.section,
    layer: f.layer,
    title: f.title,
    detail: f.detail,
    severity: f.severity,
    requires_human_review: f.requiresHumanReview,
    spans: f.spans,
    absence: f.absence ? { searched: f.absence.searched, text_sha256: f.absence.textSha256 } : null,
  }));
  const outcome = {
    rating: b.outcome.rating,
    confidence: b.outcome.confidence,
    overall: b.outcome.overall,
    overall_spans: b.outcome.overallSpans,
    recommended_actions: b.outcome.recommendedActions.map((a) => ({ text: a.text, spans: a.spans })),
  };
  const proposer = person(d.proposer, 'proposer');
  const reviewer = person(d.reviewer, 'editor');
  const audit = input.audit
    .filter((a) => a.entityId === d.id)
    .sort((x, y) => (x.at < y.at ? -1 : x.at > y.at ? 1 : x.id < y.id ? -1 : 1))
    .map((a) => ({ id: a.id, change: a.changeType, entity: `${a.entityType}:${a.entityId}`, actor: a.actorId, at: a.at, detail: a.detail }));
  const bound = { subject: source, analysis_engine: b.analysisEngine, outcome, findings, spans };
  const contentSha = digest(bound);
  const passport = {
    id: baseId,
    format: FORMAT,
    title: b.title,
    generated_at: state.t,
    tenant: input.tenant,
    status: d.status,
    subject: { kind: source.kind, report_sha256: b.reportSha256, report_schema: b.reportSchema, analysed_at: b.analysedAt, document: { filename: b.document.filename, format: b.document.format, bytes: b.document.bytes, file_sha256: b.document.fileSha256, text_sha256: b.document.textSha256, chars: b.document.chars, pages: b.document.pages, extraction: b.document.extraction } },
    analysis_engine: { version: b.analysisEngine.version, ai: { status: b.analysisEngine.ai.status, provider: b.analysisEngine.ai.provider, model: b.analysisEngine.ai.model, prompt_version: b.analysisEngine.ai.promptVersion } },
    outcome,
    findings,
    spans,
    proposer,
    reviewer,
    timeline: { drafted_at: d.createdAt, submitted_at: d.submittedAt, reviewed_at: d.reviewedAt, issued_at: d.status === 'issued' ? d.issuedAt : null },
    review_note: d.reviewNote,
    review_rule: REVIEW_RULE,
    policy: { version: input.policy.version, sha256: input.policy.sha256 },
    supersedes: d.supersedes,
    attests: ATTESTS,
    does_not_attest: DOES_NOT_ATTEST,
    sources: inventory,
    audit,
    versions: { ruleset: RULESET },
    case: { id: d.id, version: '1', content_sha256: contentSha },
    engine: input.engine,
    limits: [
      'A passport attests to process and evidence integrity, not to legal or factual correctness.',
      'Span offsets point into the analysed text, which the passport does not carry; check them against the Deep Analysis bundle. Quotes are checked by hash.',
      'Identities are Firebase Auth accounts of this workspace; the review is internal to the workspace, not an external attestation.',
      d.status === 'issued' ? 'Check revocation: an issued passport may later be revoked or superseded (see the revocation list).' : 'Not issued: this is a draft record. It carries no signature and has no standing as an issued passport.',
    ],
  };
  const who = (p: { uid: string; email: string | null } | null) => (p ? p.email ?? p.uid : 'none');
  const lines = [
    `# Decision Passport${d.status === 'issued' ? '' : ' (DRAFT, not issued)'}: ${b.title}`,
    '',
    `- Status: ${d.status}`,
    `- Workspace: ${input.tenant}`,
    `- Bound report: SHA-256 \`${b.reportSha256}\` (${b.reportSchema}, analysed ${b.analysedAt})`,
    `- Document: ${b.document.filename ?? '(file name withheld)'}, ${b.document.format}, ${b.document.bytes} bytes, file SHA-256 \`${b.document.fileSha256}\`, text SHA-256 \`${b.document.textSha256}\``,
    `- Analysis engine: ${b.analysisEngine.version}; AI layer ${b.analysisEngine.ai.status}${b.analysisEngine.ai.model ? ` (${b.analysisEngine.ai.provider ?? ''} ${b.analysisEngine.ai.model}, prompt ${b.analysisEngine.ai.promptVersion ?? 'n/a'})` : ''}`,
    `- Proposed by: ${who(proposer)} at ${d.createdAt}`,
    `- Reviewed by: ${reviewer ? `${who(reviewer)} at ${d.reviewedAt}` : 'not yet reviewed'}`,
    `- Issued: ${d.status === 'issued' ? d.issuedAt : 'not issued'}`,
    `- Policy: ${input.policy.version} (SHA-256 \`${input.policy.sha256}\`)`,
    `- Record engine: ${input.engine.version}, source SHA-256 \`${input.engine.sha256}\``,
    ...(d.supersedes ? [`- Supersedes: \`${d.supersedes}\``] : []),
    '',
    '## Outcome',
    '',
    `Rating: ${b.outcome.rating}; confidence: ${b.outcome.confidence}.`,
    '',
    b.outcome.overall,
    '',
    '## Findings',
    '',
    ...findings.map((f, i) => `${i + 1}. [${f.section}${f.severity ? `, ${f.severity}` : ''}, ${f.layer}] ${f.title}${f.spans.length ? ` (spans ${f.spans.join(', ')})` : ' (absence finding)'}`),
    '',
    '## Spans',
    '',
    ...spans.map((s) => `- ${s.id} [${s.start}, ${s.end}) SHA-256 \`${s.sha256.slice(0, 16)}…\`: ${s.quote.replace(/\s+/g, ' ').slice(0, 240)}`),
    '',
    '## What this passport attests',
    '',
    ...ATTESTS.map((x) => `- ${x}`),
    '',
    '## What it does not attest',
    '',
    ...DOES_NOT_ATTEST.map((x) => `- ${x}`),
    '',
    '## Audit trail',
    '',
    ...audit.map((a) => `- ${a.at} ${a.change} ${a.entity} by ${a.actor}`),
    '',
  ];
  return {
    state,
    passport,
    report_markdown: lines.join('\n'),
    sources: { inventory, documents: [source] },
    release: { case_id: d.id, case_version: '1', case_archive_sha256: contentSha, ruleset: RULESET, engine: input.engine },
    review: { status: d.status, reviewer, attestations: [] as unknown[] },
  };
}
