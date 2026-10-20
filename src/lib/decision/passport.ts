/**
 * Decision Passports for the public, synthetic Decision Twin.
 *
 * Stateless: the passport ID encodes a canonical snapshot of the inputs and
 * the creation time, so the same ID always rebuilds the same passport with no
 * database. The SHA-256 integrity hash is over the canonical passport content;
 * it shows the passport has not changed since it was generated, not that its
 * content is correct.
 */
import { z } from 'zod';
import { canonicalJson, sha256 } from './canonical';
import { CASE, sourceInventory } from './case';
import { chamber } from './chamber';
import { contradictionsView, type ContradictionClass } from './contradictions';
import { CONFIG_VERSION, decisionConfiguration } from './product';
import { AssumptionsSchema, DEFAULT_ASSUMPTIONS, PREMISES, evaluate, normalise, traceFromDefaults, type Assumptions } from './engine';
import { SIGNATURE_MEANING, UNSIGNED, KEYS_PATH, configuredSigner, type SignerState } from './signing';
import { ACTIVE_CASE_VERSION, ARCHIVED_CASES, archiveHash, type ArchivedCaseData } from './versions';

export const PASSPORT_PREFIX = 'DP1-';

const EnvelopeSchema = z
  .object({
    v: z.union([z.literal(1), z.literal(2)]),
    case: z.string().max(40),
    caseVersion: z.string().max(40),
    a: z.unknown(),
    t: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/),
  })
  .strict();

/**
 * Passport content formats. 1: issued up to production 690beea (no archived-case hash in the content); still
 * rebuilt byte for byte so their hashes keep verifying. 2: current; records the archived case version and its hash.
 */
export const CURRENT_FORMAT = 2;

export interface PassportState {
  v: 1 | 2;
  case: string;
  caseVersion: string;
  a: Assumptions;
  t: string;
}

export class PassportIdError extends Error {}
/** The ID is well formed but names a case version this server does not hold. */
export class UnsupportedVersionError extends PassportIdError {}

/** How one archived case version builds its passport content. */
export interface VersionEntry {
  data: ArchivedCaseData;
  /** Pinned canonical hash of `data`. */
  sha256: string;
  assumptions: z.ZodType<unknown>;
  normalise: (a: Assumptions) => Assumptions;
  build: (state: PassportState, data: ArchivedCaseData, dataSha256: string) => Record<string, unknown>;
}

export interface CaseArchive {
  active: string;
  versions: Record<string, VersionEntry>;
}

function stamp(createdAt: Date): string {
  return createdAt.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function idFor(state: PassportState): string {
  return PASSPORT_PREFIX + Buffer.from(canonicalJson(state), 'utf8').toString('base64url');
}

export function encodePassportId(a: Assumptions, createdAt: Date, archive: CaseArchive = CASE_ARCHIVE): string {
  const entry = archive.versions[archive.active];
  const state: PassportState = { v: CURRENT_FORMAT, case: entry.data.case.id, caseVersion: archive.active, a: entry.normalise(entry.assumptions.parse(a) as Assumptions), t: stamp(createdAt) };
  return idFor(state);
}

export function decodePassportId(id: string, archive: CaseArchive = CASE_ARCHIVE): PassportState {
  if (!id.startsWith(PASSPORT_PREFIX) || id.length > 2000) throw new PassportIdError('Not a Decision Passport ID.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(id.slice(PASSPORT_PREFIX.length), 'base64url').toString('utf8'));
  } catch {
    throw new PassportIdError('The passport ID cannot be decoded.');
  }
  const env = EnvelopeSchema.safeParse(parsed);
  if (!env.success) throw new PassportIdError('The passport ID does not describe a valid passport snapshot.');
  const entry = archive.versions[env.data.caseVersion];
  if (!entry || entry.data.case.id !== env.data.case) {
    throw new UnsupportedVersionError(
      `Unsupported version: this passport was issued for case ${env.data.case} version ${env.data.caseVersion}, which this server does not hold. Supported versions: ${Object.keys(archive.versions).join(', ')}.`,
    );
  }
  const a = entry.assumptions.safeParse(env.data.a);
  if (!a.success) throw new PassportIdError('The passport ID does not describe a valid snapshot of this case version.');
  const state: PassportState = { ...env.data, a: entry.normalise(a.data as Assumptions) };
  // Only the canonical encoding is accepted, so one snapshot has exactly one ID.
  if (idFor(state) !== id) throw new PassportIdError('The passport ID is not in canonical form.');
  return state;
}

export const REVIEWER_NONE = 'none (simulated decision)';

/** Passport content for case version 1.0.0, built only from the archived v1 data and the v1 rules. */
function buildV1(state: PassportState, data: ArchivedCaseData, dataSha256: string): Record<string, unknown> {
  if (state.v === 1) return buildV1Format1(state, data);
  const a = state.a;
  const ev = evaluate(a);
  const nodes = Object.values(ev);
  const trace = traceFromDefaults(a);
  return {
    id: idFor(state),
    title: `Decision Passport: ${data.case.title}`,
    label: data.case.label,
    generated_at: state.t,
    case: {
      id: data.case.id,
      version: data.version,
      content_sha256: dataSha256,
      archive: data.path,
      borrower: data.case.borrower,
      question: data.case.question,
      facility: data.case.facility,
    },
    status: 'SIMULATED: demonstration only. No credit decision has been made.',
    reviewer: REVIEWER_NONE,
    product: 'AbrahamMoses Decision Twin (demonstration)',
    versions: { ruleset: data.ruleset, configuration: CONFIG_VERSION, model: 'none (deterministic rules; no AI model)', passport_format: 'DP2' },
    configuration: decisionConfiguration(a),
    sources: sourceInventory(data.documents),
    assumptions: { ...a, defaults: DEFAULT_ASSUMPTIONS },
    premises: PREMISES.map((p) => ({ id: p.id, statement: p.statement, sources: p.sources, accepted: !a.rejected.includes(p.id) })),
    calculations: nodes
      .filter((n) => n.kind === 'metric' || n.kind === 'effective')
      .map((n) => ({ id: n.id, label: n.label, value: n.value, display: n.display, formula: n.formula ?? null, inputs: n.deps })),
    scenarios: {
      base: { leverage: ev['m.leverage'].display, coverage: ev['m.coverage'].display },
      stress: { ebitda: ev['m.stressEbitda'].display, leverage: ev['m.stressLeverage'].display, coverage: ev['m.stressCoverage'].display },
    },
    conditions: nodes.filter((n) => n.kind === 'condition').map((n) => ({ id: n.id, label: n.label, status: n.status, note: n.note ?? null })),
    warnings: nodes.filter((n) => n.kind === 'warning' && n.status === 'ACTIVE').map((n) => ({ id: n.id, label: n.label, note: n.note ?? null })),
    conclusion: ev.conclusion.display,
    claims: chamber(ev, a).map((x) => ({ id: x.id, side: x.side, text: x.text, nodes: x.nodes, docs: x.docs })),
    conflicts: contradictionsView().map((c) => ({ id: c.id, class: c.class, conflict: c.conflict, title: c.title, a: c.a, b: c.b, human_action: c.humanAction })),
    open_questions: nodes
      .filter((n) => n.kind === 'condition' && (n.status === 'NEEDS_HUMAN_JUDGMENT' || n.status === 'EVIDENCE_MISSING'))
      .map((n) => `${n.label}: ${n.note}`),
    audit_history: [
      { at: state.t, event: 'passport_generated', detail: `From case ${data.case.id} v${data.version} (archived, sha256 ${dataSha256.slice(0, 16)}…) with ruleset ${data.ruleset}.` },
      ...trace.changes.map((c) => ({ at: state.t, event: 'input_changed', detail: `${c.label}: ${c.from} → ${c.to}` })),
      ...(trace.changes.length ? [{ at: state.t, event: 'conclusions_affected', detail: trace.affected.join(', ') || 'none' }] : []),
    ],
    reproducibility:
      'Open this passport ID at /institutional/decision-room/passport/{id} or call GET /api/institutional/decision-room/passport/verify?id={id}&sha256={hash}. The ID encodes the case version and every input; the passport is rebuilt from that archived case version, so the same passport and hash are produced with no stored state.',
    legal_note:
      'Decision support only. This passport is an evidentiary and governance record. It is not a binding decision, an audit opinion, a regulatory approval or a certification; the responsible institution keeps responsibility for any decision.',
    integrity_note: SIGNATURE_MEANING,
  };
}

/**
 * Format 1 content, exactly as production 690beea built it (frozen: changing a byte breaks the hashes of passports
 * already issued). It predates the archive hash, so it carries no case.content_sha256.
 */
function buildV1Format1(state: PassportState, data: ArchivedCaseData): Record<string, unknown> {
  const a = state.a;
  const ev = evaluate(a);
  const nodes = Object.values(ev);
  const trace = traceFromDefaults(a);
  return {
    id: idFor(state),
    title: `Decision Passport: ${data.case.title}`,
    label: data.case.label,
    generated_at: state.t,
    case: { id: data.case.id, version: data.version, borrower: data.case.borrower, question: data.case.question, facility: data.case.facility },
    status: 'SIMULATED: demonstration only. No credit decision has been made.',
    reviewer: REVIEWER_NONE,
    product: 'AbrahamMoses Decision Twin (demonstration)',
    versions: { ruleset: data.ruleset, configuration: CONFIG_VERSION, model: 'none (deterministic rules; no AI model)', passport_format: 'DP1' },
    configuration: decisionConfiguration(a),
    sources: sourceInventory(data.documents),
    assumptions: { ...a, defaults: DEFAULT_ASSUMPTIONS },
    premises: PREMISES.map((p) => ({ id: p.id, statement: p.statement, sources: p.sources, accepted: !a.rejected.includes(p.id) })),
    calculations: nodes
      .filter((n) => n.kind === 'metric' || n.kind === 'effective')
      .map((n) => ({ id: n.id, label: n.label, value: n.value, display: n.display, formula: n.formula ?? null, inputs: n.deps })),
    scenarios: {
      base: { leverage: ev['m.leverage'].display, coverage: ev['m.coverage'].display },
      stress: { ebitda: ev['m.stressEbitda'].display, leverage: ev['m.stressLeverage'].display, coverage: ev['m.stressCoverage'].display },
    },
    conditions: nodes.filter((n) => n.kind === 'condition').map((n) => ({ id: n.id, label: n.label, status: n.status, note: n.note ?? null })),
    warnings: nodes.filter((n) => n.kind === 'warning' && n.status === 'ACTIVE').map((n) => ({ id: n.id, label: n.label, note: n.note ?? null })),
    conclusion: ev.conclusion.display,
    claims: chamber(ev, a).map((x) => ({ id: x.id, side: x.side, text: x.text, nodes: x.nodes, docs: x.docs })),
    conflicts: contradictionsView().map((c) => ({ id: c.id, class: c.class, conflict: c.conflict, title: c.title, a: c.a, b: c.b, human_action: c.humanAction })),
    open_questions: nodes
      .filter((n) => n.kind === 'condition' && (n.status === 'NEEDS_HUMAN_JUDGMENT' || n.status === 'EVIDENCE_MISSING'))
      .map((n) => `${n.label}: ${n.note}`),
    audit_history: [
      { at: state.t, event: 'passport_generated', detail: `From case ${data.case.id} v${data.version} with ruleset ${data.ruleset}.` },
      ...trace.changes.map((c) => ({ at: state.t, event: 'input_changed', detail: `${c.label}: ${c.from} → ${c.to}` })),
      ...(trace.changes.length ? [{ at: state.t, event: 'conclusions_affected', detail: trace.affected.join(', ') || 'none' }] : []),
    ],
    reproducibility:
      'Open this passport ID at /institutional/decision-room/passport/{id} or call GET /api/institutional/decision-room/passport/verify?id={id}&sha256={hash}. The ID encodes every input, so the same passport and hash are rebuilt with no stored state.',
    legal_note:
      'Decision support only. This passport is an evidentiary and governance record. It is not a binding decision, an audit opinion, a regulatory approval or a certification; the responsible institution keeps responsibility for any decision.',
    integrity_note: 'The SHA-256 hash shows this passport has not changed since it was generated. It does not show that the content is correct.',
  };
}

export const CASE_ARCHIVE: CaseArchive = {
  active: ACTIVE_CASE_VERSION,
  versions: {
    '1.0.0': { ...ARCHIVED_CASES['1.0.0'], assumptions: AssumptionsSchema, normalise, build: buildV1 },
  },
};

interface PassportContent {
  id: string;
  title: string;
  label: string;
  generated_at: string;
  case: { id: string; version: string; content_sha256?: string; archive?: string; borrower: string; question: string; facility: typeof CASE.facility };
  status: string;
  reviewer: string;
  product: string;
  versions: { ruleset: string; configuration: string; model: string; passport_format: string };
  configuration: ReturnType<typeof decisionConfiguration>;
  sources: ReturnType<typeof sourceInventory>;
  assumptions: Assumptions & { defaults: Assumptions };
  premises: { id: string; statement: string; sources: readonly string[]; accepted: boolean }[];
  calculations: { id: string; label: string; value: unknown; display: string; formula: string | null; inputs: readonly string[] }[];
  scenarios: { base: { leverage: string; coverage: string }; stress: { ebitda: string; leverage: string; coverage: string } };
  conditions: { id: string; label: string; status: string; note: string | null }[];
  warnings: { id: string; label: string; note: string | null }[];
  conclusion: string;
  claims: { id: string; side: string; text: string; nodes: readonly string[]; docs: readonly string[] }[];
  conflicts: { id: string; class: ContradictionClass; conflict: boolean; title: string; a: unknown; b: unknown; human_action: string }[];
  open_questions: string[];
  audit_history: { at: string; event: string; detail: string }[];
  reproducibility: string;
  legal_note: string;
  integrity_note: string;
}

export interface PassportSignature {
  status: 'signed' | typeof UNSIGNED;
  algorithm?: 'Ed25519';
  key_id?: string;
  value?: string;
  public_keys: string;
}

export function buildPassport(id: string, opts: { archive?: CaseArchive; signer?: SignerState } = {}) {
  const archive = opts.archive ?? CASE_ARCHIVE;
  const state = decodePassportId(id, archive);
  const entry = archive.versions[state.caseVersion];
  if (archiveHash(entry.data) !== entry.sha256) {
    // The archived data no longer matches the hash pinned when it was archived: refuse rather than rebuild a different record.
    throw new Error(`Archived case data for version ${state.caseVersion} does not match its pinned hash.`);
  }
  const content = entry.build(state, entry.data, entry.sha256) as unknown as PassportContent;
  const hash = sha256(canonicalJson(content));
  const signer = opts.signer ?? configuredSigner();
  const signature: PassportSignature =
    signer.status === 'signing'
      ? { status: 'signed', algorithm: 'Ed25519', key_id: signer.signer.keyId, value: signer.signer.sign(hash), public_keys: KEYS_PATH }
      : { status: UNSIGNED, public_keys: KEYS_PATH };
  return {
    ...content,
    integrity: {
      algorithm: 'SHA-256' as const,
      canonicalisation: 'JSON, keys sorted, no whitespace, integrity field excluded',
      sha256: hash,
      signature,
      case_archive: { version: entry.data.version, path: entry.data.path, content_sha256: entry.sha256, verified: true },
    },
  };
}

export type Passport = ReturnType<typeof buildPassport>;

export function verifyPassport(id: string, hash: string, opts: { archive?: CaseArchive } = {}): { valid: boolean; expected: string } {
  const p = buildPassport(id, { archive: opts.archive, signer: { status: 'unsigned' } });
  return { valid: p.integrity.sha256 === hash.toLowerCase(), expected: p.integrity.sha256 };
}

export function passportMarkdown(p: Passport): string {
  const lines = [
    `# ${p.title}`,
    '',
    `*${p.product}. Evidence Today. Wisdom Tomorrow. Evidence informs. Humans decide. The system preserves the reasoning.*`,
    '',
    `> ${p.label}`,
    '',
    `- **Passport ID:** \`${p.id}\``,
    `- **Generated:** ${p.generated_at}`,
    `- **Case:** ${p.case.id} v${p.case.version} (${p.case.borrower}); archived case data SHA-256 \`${p.integrity.case_archive.content_sha256}\``,
    `- **Question:** ${p.case.question}`,
    `- **Status:** ${p.status}`,
    `- **Reviewer:** ${p.reviewer}`,
    `- **Ruleset:** ${p.versions.ruleset}; model: ${p.versions.model}`,
    `- **SHA-256:** \`${p.integrity.sha256}\``,
    `- **Signature:** ${p.integrity.signature.status === 'signed' ? `Ed25519, key ${p.integrity.signature.key_id} (${p.integrity.signature.public_keys}): \`${p.integrity.signature.value}\`` : p.integrity.signature.status}`,
    `- ${p.integrity_note}`,
    `- ${p.legal_note}`,
    '',
    '## Decision configuration',
    '',
    `- **Configuration:** ${p.configuration.version}`,
    `- **Objective:** ${p.configuration.objective}`,
    `- **Evidence standard:** ${p.configuration.evidence_standard}`,
    `- **Approval policy:** ${p.configuration.approval_policy.actions.join(' / ')}. ${p.configuration.approval_policy.rule}`,
    '',
    '| State | Assumption | Value | Source |',
    '|---|---|---|---|',
    ...p.configuration.assumptions.map((x) => `| ${x.state} | ${x.label} | ${x.value} | ${x.source} |`),
    '',
    '**Escalation rules**',
    '',
    ...p.configuration.escalation_rules.map((r) => `- ${r}`),
    '',
    '**Monitoring triggers**',
    '',
    ...p.configuration.monitoring_triggers.map((r) => `- ${r}`),
    '',
    '## Conclusion',
    '',
    p.conclusion,
    '',
    '## Conditions',
    '',
    '| Condition | Status | Note |',
    '|---|---|---|',
    ...p.conditions.map((c) => `| ${c.label} | ${c.status} | ${c.note ?? ''} |`),
    '',
    '## Calculations',
    '',
    '| Measure | Value | Formula |',
    '|---|---|---|',
    ...p.calculations.map((c) => `| ${c.label} | ${c.display} | ${c.formula ?? ''} |`),
    '',
    '## Premises',
    '',
    ...p.premises.map((x) => `- ${x.id} (${x.accepted ? 'accepted' : 'rejected'}): ${x.statement} [${x.sources.join(', ')}]`),
    '',
    '## Warnings',
    '',
    ...(p.warnings.length ? p.warnings.map((w) => `- ${w.label}: ${w.note}`) : ['- None active.']),
    '',
    '## Conflicts and evidence gaps',
    '',
    ...p.conflicts.map((c) => `- ${c.id} ${c.class}${c.conflict ? '' : ' (not a conflict)'}: ${c.title}. ${c.human_action}`),
    '',
    '## Open questions for human judgment',
    '',
    ...p.open_questions.map((q) => `- ${q}`),
    '',
    '## Sources',
    '',
    '| ID | Title | Date | Verification | SHA-256 |',
    '|---|---|---|---|---|',
    ...p.sources.map((s) => `| ${s.id} | ${s.title} | ${s.date} | ${s.verification} | \`${s.sha256.slice(0, 16)}…\` |`),
    '',
    '## Audit history',
    '',
    ...p.audit_history.map((h) => `- ${h.at} ${h.event}: ${h.detail}`),
    '',
    '## Reproducibility',
    '',
    p.reproducibility,
    '',
  ];
  return lines.join('\n');
}
