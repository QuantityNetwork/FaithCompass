/**
 * The public verification service behind POST /api/passport/verify and the portal at
 * /institutional/decision-passport/verify. Runs the reference verifier with the PINNED production keys (the same file
 * the offline Go verifier ships with) and the pinned engines, then adds what a bundle cannot say about itself:
 * whether its hash is in the public registry (with the registry's own signature checked), and whether it was
 * revoked. When the registry is not reachable on this deployment those checks are reported as not checked,
 * never as passed.
 */
import productionKeys from '../../../packages/decision-verifier/keys/production.json';
import { ENGINES } from '@/lib/decision/engines';
import { HISTORICAL_KEYS } from '@/lib/decision/keys';
import { verifyIssued } from '@/lib/decision/signing';
import { verifyBundle as verifyDeepBundle } from '@/lib/deep-analysis/bundle';
import { firestoreConfigFromEnv, firestoreConfigured, FirestoreRest } from '@/lib/firebase/firestore-rest';
import { verifyBundle, type Check, type PinnedKey, type Report } from '@/lib/passport-bundle/verify';
import { knownPolicy } from './policy';
import { registryByPassportId, registryEntry, revocationOf, type RegistryEntry, type RevocationDoc } from './store';

export const PINNED_KEYS: PinnedKey[] = [
  ...(productionKeys.keys as PinnedKey[]),
  ...HISTORICAL_KEYS.filter((h) => !(productionKeys.keys as PinnedKey[]).some((k) => k.kid === h.kid)),
];
export const PINNED_ENGINES = Object.values(ENGINES).map((e) => ({ version: e.version, sha256: e.sha256 }));

/** What each check means, for the portal. */
export const CHECK_EXPLANATIONS: Record<string, string> = {
  schema: 'The file is a Decision Passport bundle of a supported schema version (1.0.0), with all seven artifacts.',
  passport_hash: 'SHA-256 over the canonical JSON of the passport equals the hash in the manifest: the passport content is unchanged.',
  expected_hash: 'The recomputed hash equals a hash you obtained independently (for example from the issuer).',
  'ref:id_state': 'The passport ID encodes exactly the state stored in the bundle.',
  'ref:passport_id': 'The passport names the same ID as the bundle.',
  'ref:state_assumptions': 'The passport time and inputs equal the state the ID encodes.',
  'ref:sources': 'The passport lists the same sources as the bundle inventory.',
  source_documents: 'Each source document hashes to the value recorded in the inventory.',
  'ref:release': 'Ruleset, case and engine named by the passport match the release manifest.',
  engine_known: 'The engine (or record builder) that produced the passport is a pinned, frozen release.',
  'ref:review': 'Review status and reviewer are the same in the passport and the review artifact.',
  signature: 'The Ed25519 issuance signature verifies with a pinned key that was valid at the issue time, and the issue time equals the passport time.',
  revocation: 'The passport hash is not on the revocation list.',
  registry: 'The hash is in the public registry of issued passports, and the registry entry carries a valid signature by a pinned key.',
  key_status: 'The signing key is active or retired (not revoked) in the pinned key list.',
  policy: 'The passport names a published Passport Policy version, and its digest matches.',
  deep_analysis: 'The Deep Analysis bundle you supplied verifies and is the report this passport is bound to; every cited span quote matches.',
};

export type RegistryStatus = 'registered' | 'not_registered' | 'signature_invalid' | 'unavailable';
export interface VerifyResult {
  verdict: 'VALID' | 'INVALID' | 'UNSUPPORTED' | 'REVOKED' | 'REGISTERED' | 'NOT_FOUND';
  summary: string;
  passport_sha256: string | null;
  report: Report | null;
  checks: (Check & { explanation: string })[];
  registry: { status: RegistryStatus; entry: RegistryEntry | null };
  revocation: { status: 'not_revoked' | 'revoked' | 'unavailable'; entry: RevocationDoc | null };
  key: PinnedKey | null;
  notes: string[];
}

export interface Store {
  entry(sha: string): Promise<RegistryEntry | null>;
  byId(id: string): Promise<RegistryEntry | null>;
  revocation(sha: string): Promise<RevocationDoc | null>;
}

/** The public store of this deployment (unauthenticated reads), or null when Firestore is not configured. */
export function publicStore(env: Record<string, string | undefined> = process.env): Store | null {
  if (!firestoreConfigured(env)) return null;
  const db = new FirestoreRest(firestoreConfigFromEnv(env), null);
  return { entry: (s) => registryEntry(db, s), byId: (i) => registryByPassportId(db, i), revocation: (s) => revocationOf(db, s) };
}

const explain = (c: Check) => ({ ...c, explanation: CHECK_EXPLANATIONS[c.id.split(':')[0] === 'artifact_hash' ? 'passport_hash' : c.id] ?? (c.id.startsWith('artifact_hash') ? 'This artifact hashes to the value in the manifest.' : c.id.startsWith('attestation') ? 'A reviewer attestation verifies with a pinned key.' : '') });

async function lookups(store: Store | null, sha: string | null, keys: readonly PinnedKey[]) {
  const reg: VerifyResult['registry'] = { status: 'unavailable', entry: null };
  const rev: VerifyResult['revocation'] = { status: 'unavailable', entry: null };
  if (!store || !sha) return { reg, rev };
  try {
    const e = await store.entry(sha);
    reg.entry = e;
    if (!e) reg.status = 'not_registered';
    else {
      const ok = verifyIssued(sha, { alg: 'Ed25519', kid: e.kid, issued_at: e.issuedAt, value: e.signatureValue }, keys);
      reg.status = ok.valid ? 'registered' : 'signature_invalid';
    }
  } catch {
    reg.status = 'unavailable';
  }
  try {
    const r = await store.revocation(sha);
    rev.entry = r;
    rev.status = r ? 'revoked' : 'not_revoked';
  } catch {
    rev.status = 'unavailable';
  }
  return { reg, rev };
}

function addLookupChecks(checks: VerifyResult['checks'], reg: VerifyResult['registry'], rev: VerifyResult['revocation'], signed: boolean) {
  const regStatus = reg.status === 'registered' ? 'pass' : reg.status === 'unavailable' ? 'uncheckable' : signed || reg.status === 'signature_invalid' ? 'fail' : 'uncheckable';
  const regDetail = {
    registered: `registered: issued ${reg.entry?.issuedAt}, key ${reg.entry?.kid}, registry signature valid`,
    not_registered: signed ? 'not in the registry of issued passports' : 'not in the registry (expected for an unsigned draft)',
    signature_invalid: 'a registry entry exists but its signature does not verify with a pinned key: not issued by the operator',
    unavailable: 'the registry is not reachable from this deployment: not checked',
  }[reg.status];
  checks.push(explain({ id: 'registry', status: regStatus, detail: regDetail }));
  checks.push(
    explain({
      id: 'revocation',
      status: rev.status === 'revoked' ? 'fail' : rev.status === 'not_revoked' ? 'pass' : 'uncheckable',
      detail: rev.status === 'revoked' ? `revoked ${rev.entry?.revokedAt} (${rev.entry?.reason}${rev.entry?.supersededBy ? `, superseded by ${rev.entry.supersededBy}` : ''})` : rev.status === 'not_revoked' ? 'not on the revocation list' : 'the revocation list is not reachable from this deployment: not checked',
    }),
  );
}

export async function verifyPassportInput(
  input: { bundle?: unknown; id?: string; sha256?: string; deepAnalysis?: unknown },
  store: Store | null = publicStore(),
  keys: readonly PinnedKey[] = PINNED_KEYS,
): Promise<VerifyResult> {
  const notes: string[] = [];
  if (input.bundle !== undefined) {
    const report = verifyBundle(input.bundle, { keys, engines: PINNED_ENGINES, expectedSha256: input.sha256 });
    const sha = report.passport_sha256;
    const checks = report.checks.map(explain);
    const b = input.bundle as { artifacts?: { crypto?: { signature?: { kid?: string } | null }; passport?: Record<string, any> } };
    const kid = b.artifacts?.crypto?.signature?.kid;
    const key = kid ? (keys.find((k) => k.kid === kid) ?? null) : null;
    if (kid) checks.push(explain({ id: 'key_status', status: key ? (key.status === 'revoked' ? 'fail' : 'pass') : 'fail', detail: key ? `${kid}: ${key.status}${key.not_before ? `, valid from ${key.not_before}` : ''}${key.not_after ? ` to ${key.not_after}` : ''}` : `${kid} is not a pinned key` }));
    const p = b.artifacts?.passport;
    if (p && p.policy) {
      const known = knownPolicy(p.policy.version, p.policy.sha256);
      checks.push(explain({ id: 'policy', status: known ? 'pass' : 'fail', detail: known ? `${known.version}` : `unknown policy ${String(p.policy.version)}` }));
    }
    const { reg, rev } = await lookups(sha && report.result !== 'UNSUPPORTED' ? store : null, sha, keys);
    if (sha && report.result !== 'UNSUPPORTED') addLookupChecks(checks, reg, rev, report.signature !== 'unsigned');
    if (input.deepAnalysis !== undefined && p) {
      const deep = verifyDeepBundle(input.deepAnalysis);
      const r = (input.deepAnalysis as { report?: { seal?: { reportSha256?: string }; spans?: { id: string; sha256: string; quote: string; start: number; end: number }[] } }).report;
      const problems = [...deep.problems];
      if (r?.seal?.reportSha256 !== p.subject?.report_sha256) problems.push('the Deep Analysis report is not the one this passport is bound to');
      for (const s of (p.spans ?? []) as { id: string; sha256: string; start: number; end: number }[]) {
        const m = r?.spans?.find((x) => x.id === s.id);
        if (!m || m.sha256 !== s.sha256 || m.start !== s.start || m.end !== s.end) problems.push(`span ${s.id} differs from the report`);
      }
      checks.push(explain({ id: 'deep_analysis', status: problems.length ? 'fail' : 'pass', detail: problems.length ? problems.slice(0, 5).join('; ') : `report ${r?.seal?.reportSha256?.slice(0, 12)}… verified, ${deep.spansChecked} spans checked against the text` }));
    }
    const failed = checks.filter((c) => c.status === 'fail');
    const revoked = rev.status === 'revoked';
    const verdict: VerifyResult['verdict'] = report.result === 'UNSUPPORTED' ? 'UNSUPPORTED' : revoked ? 'REVOKED' : failed.length ? 'INVALID' : 'VALID';
    if (report.signature === 'unsigned') notes.push('Unsigned: the bundle is internally consistent, but nothing shows who produced it. Only issued passports are signed.');
    if (p?.status && p.status !== 'issued') notes.push(`Status ${p.status}: this is a draft record, not an issued passport.`);
    notes.push('A valid passport attests to process and evidence integrity, not to legal or factual correctness.');
    const summary = {
      VALID: report.signature === 'valid' ? 'Valid: unchanged since issue and signed by the operator key.' : 'Consistent but unsigned: unchanged since it was exported; issuer not authenticated.',
      INVALID: `Invalid: ${failed.map((c) => c.id).join(', ')} failed.`,
      UNSUPPORTED: 'Unsupported: not a passport bundle this verifier knows (schema or engine).',
      REVOKED: 'Revoked: the passport verifies but was revoked by its issuer; do not rely on it.',
      REGISTERED: '',
      NOT_FOUND: '',
    }[verdict];
    return { verdict, summary, passport_sha256: sha, report, checks, registry: reg, revocation: rev, key, notes };
  }

  // No bundle: look up an ID or a hash in the registry. Content cannot be checked without the bundle.
  let sha = input.sha256?.toLowerCase() ?? null;
  const checks: VerifyResult['checks'] = [];
  let entry: RegistryEntry | null = null;
  if (!sha && input.id) {
    if (!store) return { verdict: 'NOT_FOUND', summary: 'The registry is not reachable from this deployment; upload the bundle to verify it offline.', passport_sha256: null, report: null, checks, registry: { status: 'unavailable', entry: null }, revocation: { status: 'unavailable', entry: null }, key: null, notes };
    try {
      entry = await store.byId(input.id.trim());
    } catch {
      entry = null;
    }
    sha = entry?.sha256 ?? null;
    if (!sha) return { verdict: 'NOT_FOUND', summary: 'No issued passport with this ID is in the registry. Draft and Decision Room passports are not registered; upload the bundle instead.', passport_sha256: null, report: null, checks, registry: { status: 'not_registered', entry: null }, revocation: { status: 'unavailable', entry: null }, key: null, notes };
  }
  if (!sha || !/^[0-9a-f]{64}$/.test(sha)) return { verdict: 'NOT_FOUND', summary: 'Give a bundle, a passport ID or a 64-hex SHA-256.', passport_sha256: null, report: null, checks, registry: { status: 'unavailable', entry: null }, revocation: { status: 'unavailable', entry: null }, key: null, notes };
  const { reg, rev } = await lookups(store, sha, keys);
  addLookupChecks(checks, reg, rev, true);
  const key = reg.entry ? (keys.find((k) => k.kid === reg.entry!.kid) ?? null) : null;
  if (reg.entry) checks.push(explain({ id: 'key_status', status: key && key.status !== 'revoked' ? 'pass' : 'fail', detail: key ? `${key.kid}: ${key.status}` : `${reg.entry.kid} is not a pinned key` }));
  notes.push('Registry lookup only: the passport content was not checked. Upload the bundle to recompute every hash.');
  const verdict = rev.status === 'revoked' ? 'REVOKED' : reg.status === 'registered' ? 'REGISTERED' : reg.status === 'unavailable' ? 'NOT_FOUND' : 'NOT_FOUND';
  const summary = verdict === 'REVOKED' ? 'Revoked by its issuer.' : verdict === 'REGISTERED' ? `Registered: issued ${reg.entry?.issuedAt} with key ${reg.entry?.kid}; registry signature valid.` : reg.status === 'unavailable' ? 'The registry is not reachable from this deployment.' : reg.status === 'signature_invalid' ? 'A registry entry exists but its signature is not valid: not issued by the operator.' : 'Not in the registry of issued passports.';
  return { verdict, summary, passport_sha256: sha, report: null, checks, registry: reg, revocation: rev, key, notes };
}
