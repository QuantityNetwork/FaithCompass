/**
 * Decision Passports for the public, synthetic Decision Twin.
 *
 * Stateless: the passport ID encodes a canonical snapshot of the inputs, the case version, the engine version and
 * the creation time, so the same ID always rebuilds the same passport with no database. The passport is rebuilt
 * from the archived case data (versions/) with the frozen engine (engines/) it names, never from the live code.
 * The SHA-256 integrity hash is over the canonical passport content; it shows the passport has not changed since
 * it was generated, not that its content is correct.
 *
 * Signatures are made once, at issuance (`issuePassportId`), and carried in the ID after `.S-`. Rendering and
 * verification check the signature as issued and never sign.
 */
import { z } from 'zod';
import { canonicalJson, sha256 } from './canonical';
import { buildFormat1, buildFormat2, buildFormat3, type V1State } from './engines/v1/build';
import { buildFormat3 as buildFormat3V11 } from './engines/v1_1/build';
import { AssumptionsSchema, normalise, type Assumptions } from './engines/v1/engine';
import type { DecisionConfiguration } from './engines/v1/config';
import { ENGINES, ENGINE_FOR_CASE, type EngineEntry } from './engines';
import type { ContradictionClass } from './contradictions';
import type { PublishedKey } from './keys';
import { KEYS_PATH, UNSIGNED, configuredSigner, keyRegistry, verifyIssued, type IssuedSignature, type SignerState } from './signing';
import { ACTIVE_CASE_VERSION, ARCHIVED_CASES, archiveHash, type ArchivedCaseData } from './versions';

export { REVIEWER_NONE } from './engines/v1/build';

export const PASSPORT_PREFIX = 'DP1-';
/** Separates the issued signature from the snapshot in a signed passport ID. */
export const SIGNATURE_SEPARATOR = '.S-';

const EnvelopeSchema = z
  .object({
    v: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    case: z.string().max(40),
    caseVersion: z.string().max(40),
    e: z.string().max(40).optional(),
    a: z.unknown(),
    t: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/),
  })
  .strict();

const SignatureSchema = z
  .object({
    alg: z.literal('Ed25519'),
    kid: z.string().min(1).max(80),
    issued_at: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/),
    value: z.string().regex(/^[A-Za-z0-9_-]{80,100}$/),
  })
  .strict();

/**
 * Passport content formats. 1: issued up to production 690beea (no archived-case hash). 2: production PR #17
 * (archived case version and hash; signature, if any, made at render time). 3: current; adds the frozen engine
 * version and hash, and the signature is made once at issuance. Formats 1 and 2 are rebuilt byte for byte by the
 * frozen v1 engine so their hashes keep verifying.
 */
export const CURRENT_FORMAT = 3;

export interface PassportState {
  v: 1 | 2 | 3;
  case: string;
  caseVersion: string;
  /** Engine version key (format 3 only). */
  e?: string;
  a: Assumptions;
  t: string;
}

export class PassportIdError extends Error {}
/** The ID is well formed but names a case or engine version this server does not hold. */
export class UnsupportedVersionError extends PassportIdError {}

/** How one archived case version builds its passport content. */
export interface VersionEntry {
  data: ArchivedCaseData;
  /** Pinned canonical hash of `data`. */
  sha256: string;
  assumptions: z.ZodType<unknown>;
  normalise: (a: Assumptions) => Assumptions;
  /** Engine version key used for new (format 3) passports of this case version. */
  engine: string;
  build: (id: string, state: PassportState, data: ArchivedCaseData, dataSha256: string, engine: EngineEntry | null) => Record<string, unknown>;
}

export interface CaseArchive {
  active: string;
  versions: Record<string, VersionEntry>;
  engines: Record<string, EngineEntry>;
}

function stamp(createdAt: Date): string {
  return createdAt.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function idFor(state: PassportState): string {
  return PASSPORT_PREFIX + Buffer.from(canonicalJson(state), 'utf8').toString('base64url');
}

function snapshotFor(a: Assumptions, createdAt: Date, archive: CaseArchive): PassportState {
  const entry = archive.versions[archive.active];
  return { v: CURRENT_FORMAT, case: entry.data.case.id, caseVersion: archive.active, e: entry.engine, a: entry.normalise(entry.assumptions.parse(a) as Assumptions), t: stamp(createdAt) };
}

/** An unsigned passport ID for these inputs (format 3). */
export function encodePassportId(a: Assumptions, createdAt: Date, archive: CaseArchive = CASE_ARCHIVE): string {
  return idFor(snapshotFor(a, createdAt, archive));
}

/**
 * Issue a passport: the ID for these inputs, signed once now if a signing key is configured. The signature covers
 * the content hash, the key id and the issue time (= the passport's generated_at), and is carried in the ID.
 */
export function issuePassportId(a: Assumptions, createdAt: Date, opts: { archive?: CaseArchive; signer?: SignerState } = {}): string {
  const archive = opts.archive ?? CASE_ARCHIVE;
  const state = snapshotFor(a, createdAt, archive);
  const base = idFor(state);
  const signer = opts.signer ?? configuredSigner();
  if (signer.status !== 'signing') return base;
  const { hash } = contentFor(base, state, archive);
  const sig: IssuedSignature = { alg: 'Ed25519', kid: signer.signer.keyId, issued_at: state.t, value: signer.signer.signIssuance(hash, state.t) };
  return base + SIGNATURE_SEPARATOR + Buffer.from(canonicalJson(sig), 'utf8').toString('base64url');
}

export interface DecodedPassport {
  state: PassportState;
  /** The snapshot part of the ID, without the issued signature. The content's `id`. */
  baseId: string;
  signature: IssuedSignature | null;
}

export function decodePassport(id: string, archive: CaseArchive = CASE_ARCHIVE): DecodedPassport {
  if (!id.startsWith(PASSPORT_PREFIX) || id.length > 2400) throw new PassportIdError('Not a Decision Passport ID.');
  const cut = id.indexOf(SIGNATURE_SEPARATOR);
  const baseId = cut === -1 ? id : id.slice(0, cut);
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(baseId.slice(PASSPORT_PREFIX.length), 'base64url').toString('utf8'));
  } catch {
    throw new PassportIdError('The passport ID cannot be decoded.');
  }
  const env = EnvelopeSchema.safeParse(parsed);
  if (!env.success) throw new PassportIdError('The passport ID does not describe a valid passport snapshot.');
  if ((env.data.v === 3) !== (env.data.e !== undefined)) throw new PassportIdError('The passport ID does not describe a valid passport snapshot.');
  const entry = archive.versions[env.data.caseVersion];
  if (!entry || entry.data.case.id !== env.data.case) {
    throw new UnsupportedVersionError(
      `Unsupported version: this passport was issued for case ${env.data.case} version ${env.data.caseVersion}, which this server does not hold. Supported versions: ${Object.keys(archive.versions).join(', ')}.`,
    );
  }
  if (env.data.e !== undefined && !archive.engines[env.data.e]) {
    throw new UnsupportedVersionError(`Unsupported version: this passport names engine ${env.data.e}, which this server does not hold.`);
  }
  const a = entry.assumptions.safeParse(env.data.a);
  if (!a.success) throw new PassportIdError('The passport ID does not describe a valid snapshot of this case version.');
  const state: PassportState = { ...env.data, a: entry.normalise(a.data as Assumptions) };
  // Only the canonical encoding is accepted, so one snapshot has exactly one ID.
  if (idFor(state) !== baseId) throw new PassportIdError('The passport ID is not in canonical form.');
  let signature: IssuedSignature | null = null;
  if (cut !== -1) {
    if (state.v !== 3) throw new PassportIdError('Only format 3 passports carry an issued signature.');
    let raw: unknown;
    try {
      raw = JSON.parse(Buffer.from(id.slice(cut + SIGNATURE_SEPARATOR.length), 'base64url').toString('utf8'));
    } catch {
      throw new PassportIdError('The passport signature cannot be decoded.');
    }
    const sig = SignatureSchema.safeParse(raw);
    if (!sig.success || sig.data.issued_at !== state.t) throw new PassportIdError('The passport signature is not valid for this snapshot.');
    signature = sig.data;
    if (baseId + SIGNATURE_SEPARATOR + Buffer.from(canonicalJson(signature), 'utf8').toString('base64url') !== id) {
      throw new PassportIdError('The passport ID is not in canonical form.');
    }
  }
  return { state, baseId, signature };
}

export function decodePassportId(id: string, archive: CaseArchive = CASE_ARCHIVE): PassportState {
  return decodePassport(id, archive).state;
}

/** Case version 1.0.0: every format is built by the frozen v1 engine only. */
function buildCaseV1(id: string, state: PassportState, data: ArchivedCaseData, dataSha256: string, engine: EngineEntry | null): Record<string, unknown> {
  const s: V1State = { t: state.t, a: state.a };
  if (state.v === 1) return buildFormat1(id, s, data);
  if (state.v === 2) return buildFormat2(id, s, data, dataSha256);
  if (!engine) throw new UnsupportedVersionError('A format 3 passport must name its engine.');
  // Each frozen engine builds with its own frozen code.
  if (state.e === '1.1.0') return buildFormat3V11(id, s, data, dataSha256, engine);
  if (state.e !== '1.0.0') throw new UnsupportedVersionError(`No builder for engine ${state.e}.`);
  return buildFormat3(id, s, data, dataSha256, engine);
}

export const CASE_ARCHIVE: CaseArchive = {
  active: ACTIVE_CASE_VERSION,
  versions: {
    '1.0.0': { ...ARCHIVED_CASES['1.0.0'], assumptions: AssumptionsSchema, normalise, engine: ENGINE_FOR_CASE['1.0.0'], build: buildCaseV1 },
  },
  engines: ENGINES,
};

function contentFor(baseId: string, state: PassportState, archive: CaseArchive) {
  const entry = archive.versions[state.caseVersion];
  if (archiveHash(entry.data) !== entry.sha256) {
    // The archived data no longer matches the hash pinned when it was archived: refuse rather than rebuild a different record.
    throw new Error(`Archived case data for version ${state.caseVersion} does not match its pinned hash.`);
  }
  const engine = state.e !== undefined ? archive.engines[state.e] : null;
  const content = entry.build(baseId, state, entry.data, entry.sha256, engine) as unknown as PassportContent;
  return { content, hash: sha256(canonicalJson(content)), entry, engine };
}

interface PassportContent {
  id: string;
  title: string;
  label: string;
  generated_at: string;
  case: { id: string; version: string; content_sha256?: string; archive?: string; borrower: string; question: string; facility: unknown };
  status: string;
  reviewer: string;
  product: string;
  versions: { ruleset: string; configuration: string; model: string; passport_format: string };
  configuration: DecisionConfiguration;
  sources: { id: string; title: string; date: string; verification: string; sha256: string }[];
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
  engine?: { version: string; sha256: string; source: string };
}

export interface PassportSignature {
  status: 'signed' | typeof UNSIGNED;
  algorithm?: 'Ed25519';
  key_id?: string;
  issued_at?: string;
  value?: string;
  /** Whether the issued signature verifies against the published key for its kid and validity window. */
  valid?: boolean;
  reason?: string;
  public_keys: string;
}

export function buildPassport(id: string, opts: { archive?: CaseArchive; keys?: readonly PublishedKey[] } = {}) {
  const archive = opts.archive ?? CASE_ARCHIVE;
  const decoded = decodePassport(id, archive);
  const { content, hash, entry, engine } = contentFor(decoded.baseId, decoded.state, archive);
  let signature: PassportSignature = { status: UNSIGNED, public_keys: KEYS_PATH };
  if (decoded.signature) {
    const check = verifyIssued(hash, decoded.signature, opts.keys ?? keyRegistry());
    signature = {
      status: 'signed',
      algorithm: 'Ed25519',
      key_id: decoded.signature.kid,
      issued_at: decoded.signature.issued_at,
      value: decoded.signature.value,
      valid: check.valid,
      ...(check.valid ? {} : { reason: check.reason }),
      public_keys: KEYS_PATH,
    };
  }
  return {
    ...content,
    passport_id: id,
    integrity: {
      algorithm: 'SHA-256' as const,
      canonicalisation: 'JSON, keys sorted, no whitespace; integrity and passport_id fields excluded',
      sha256: hash,
      signature,
      case_archive: { version: entry.data.version, path: entry.data.path, content_sha256: entry.sha256, verified: true },
      engine: engine ? { version: engine.version, sha256: engine.sha256, source: engine.source } : { version: 'pre-engine-versioning (frozen v1 builders)', sha256: null, source: 'src/lib/decision/engines/v1' },
    },
  };
}

export type Passport = ReturnType<typeof buildPassport>;

export function verifyPassport(id: string, hash: string, opts: { archive?: CaseArchive } = {}): { valid: boolean; expected: string } {
  const archive = opts.archive ?? CASE_ARCHIVE;
  const decoded = decodePassport(id, archive);
  const { hash: expected } = contentFor(decoded.baseId, decoded.state, archive);
  return { valid: expected === hash.toLowerCase(), expected };
}

export function passportMarkdown(p: Passport): string {
  const lines = [
    `# ${p.title}`,
    '',
    `*${p.product}. Evidence Today. Wisdom Tomorrow. Evidence informs. Humans decide. The system preserves the reasoning.*`,
    '',
    `> ${p.label}`,
    '',
    `- **Passport ID:** \`${p.passport_id}\``,
    `- **Generated:** ${p.generated_at}`,
    `- **Case:** ${p.case.id} v${p.case.version} (${p.case.borrower}); archived case data SHA-256 \`${p.integrity.case_archive.content_sha256}\``,
    `- **Question:** ${p.case.question}`,
    `- **Status:** ${p.status}`,
    `- **Reviewer:** ${p.reviewer}`,
    `- **Ruleset:** ${p.versions.ruleset}; model: ${p.versions.model}`,
    `- **Engine:** ${p.integrity.engine.version}${p.integrity.engine.sha256 ? `, source SHA-256 \`${p.integrity.engine.sha256}\`` : ''} (frozen, ${p.integrity.engine.source})`,
    `- **SHA-256:** \`${p.integrity.sha256}\``,
    `- **Signature:** ${p.integrity.signature.status === 'signed' ? `${p.integrity.signature.valid ? 'valid as issued' : `invalid (${p.integrity.signature.reason})`}; Ed25519, key ${p.integrity.signature.key_id}, issued ${p.integrity.signature.issued_at} (${p.integrity.signature.public_keys}): \`${p.integrity.signature.value}\`` : p.integrity.signature.status}`,
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
