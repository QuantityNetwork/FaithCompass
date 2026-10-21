/**
 * Reference (TypeScript) verifier for passport bundles. Mirrors packages/decision-verifier (Go), which is the
 * independent implementation; both run the shared conformance fixtures. Uses only canonical JSON, SHA-256 and
 * Ed25519 from node:crypto: it does not call the passport builder. (`rebuildCheck` is a separate, app-only check.)
 */
import { createPublicKey, verify as edVerify } from 'node:crypto';
import { canonicalJson, sha256 } from '@/lib/decision/canonical';

export const VERIFIER = 'decision-verifier-ts/1.0.0';
export const SUPPORTED_SCHEMAS = ['1.0.0'];
const ARTIFACTS = ['passport', 'report_markdown', 'state', 'sources', 'release', 'review', 'crypto'];

export type CheckStatus = 'pass' | 'fail' | 'uncheckable';
export interface Check {
  id: string;
  status: CheckStatus;
  detail: string;
}
export interface PinnedKey {
  kid: string;
  x: string;
  status: 'active' | 'retired' | 'revoked';
  not_before: string | null;
  not_after: string | null;
  revoked_at?: string | null;
}
export interface PinnedEngine {
  version: string;
  sha256: string;
}
export interface VerifyOptions {
  keys: readonly PinnedKey[];
  engines: readonly PinnedEngine[];
  /** A hash obtained independently of the bundle (e.g. recorded at issuance). */
  expectedSha256?: string;
  /**
   * A revocation list (GET /api/passport/revocations), checked with the pinned keys. When given, a `revocation` check
   * is added: fail if the passport is listed, pass if not listed in a validly signed list, uncheckable otherwise.
   * Omitted: no revocation check (the bundle alone cannot say whether it was revoked later).
   */
  revocations?: unknown;
}

export const REVOCATION_LIST_KIND = 'abrahammoses-passport-revocations';
export const REVOCATION_REASONS = ['superseded', 'withdrawn', 'error', 'key-compromise'] as const;
export interface RevocationEntry {
  passport_sha256: string;
  revoked_at: string;
  reason: (typeof REVOCATION_REASONS)[number];
  superseded_by: string | null;
}

/** Bytes signed for a revocation list: domain-separated from passport issuance. */
export function revocationListMessage(listSha: string, kid: string, issuedAt: string) {
  return `AbrahamMoses revocation list v1\n${listSha.toLowerCase()}\n${kid}\n${issuedAt}`;
}

/** The digest a revocation list is signed over: canonical JSON of its object, version, generated_at and entries. */
export function revocationListDigest(l: { object: unknown; version: unknown; generated_at: unknown; entries: unknown }) {
  return sha256(canonicalJson({ object: l.object, version: l.version, generated_at: l.generated_at, entries: l.entries }));
}

export type RevocationListCheck = { status: 'valid' | 'unsigned' | 'invalid'; detail: string; entries: RevocationEntry[] };

/** Check a revocation list's shape, digest and signature against pinned keys. */
export function verifyRevocationList(list: unknown, keys: readonly PinnedKey[]): RevocationListCheck {
  const entryOk = (e: unknown) =>
    isObj(e) && typeof e.passport_sha256 === 'string' && /^[0-9a-f]{64}$/.test(e.passport_sha256) && typeof e.revoked_at === 'string' &&
    (REVOCATION_REASONS as readonly string[]).includes(e.reason) && (e.superseded_by === null || (typeof e.superseded_by === 'string' && /^[0-9a-f]{64}$/.test(e.superseded_by)));
  if (!isObj(list) || list.object !== REVOCATION_LIST_KIND || list.version !== 1 || typeof list.generated_at !== 'string' || !Array.isArray(list.entries) || !list.entries.every(entryOk))
    return { status: 'invalid', detail: 'not a revocation list (version 1)', entries: [] };
  const entries = list.entries as RevocationEntry[];
  const d = revocationListDigest(list as never);
  if (list.list_sha256 !== d) return { status: 'invalid', detail: 'list digest does not match its entries', entries };
  if (list.signature === null || list.signature === undefined) return { status: 'unsigned', detail: `unsigned list (${entries.length} entries): authenticity not checked`, entries };
  if (!isObj(list.signature)) return { status: 'invalid', detail: 'malformed list signature', entries };
  if (list.signature.issued_at !== list.generated_at) return { status: 'invalid', detail: 'list signature time differs from generated_at', entries };
  const res = checkSig(revocationListMessage(d, list.signature.kid, list.signature.issued_at), list.signature, keys);
  return { status: res.ok ? 'valid' : 'invalid', detail: res.ok ? `signed list of ${entries.length} entries, ${res.detail}` : `list signature: ${res.detail}`, entries };
}
export interface Report {
  verifier: string;
  schema_version: string | null;
  result: 'VALID' | 'INVALID' | 'UNSUPPORTED';
  signature: 'valid' | 'invalid' | 'unsigned';
  passport_sha256: string | null;
  checks: Check[];
  failed: string[];
  uncheckable: string[];
}

const digest = (v: unknown) => sha256(canonicalJson(v));
const isObj = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null && !Array.isArray(v);
const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);

export function issuanceMessage(sha: string, kid: string, issuedAt: string) {
  return `AbrahamMoses Decision Passport issuance v2\n${sha.toLowerCase()}\n${kid}\n${issuedAt}`;
}

function ed25519(message: string, sigB64url: string, x: string): boolean {
  try {
    const pub = createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x }, format: 'jwk' });
    return edVerify(null, Buffer.from(message, 'utf8'), pub, Buffer.from(sigB64url, 'base64url'));
  } catch {
    return false;
  }
}

function b64urlJson(s: string): unknown {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new Error('not base64url');
  return JSON.parse(Buffer.from(s, 'base64url').toString('utf8'));
}

/** Check one signature (issuance or attestation) against pinned keys. */
function checkSig(message: string, sig: Record<string, any>, keys: readonly PinnedKey[]): { ok: boolean; detail: string } {
  if (sig.alg !== 'Ed25519' || typeof sig.kid !== 'string' || typeof sig.value !== 'string' || typeof sig.issued_at !== 'string') return { ok: false, detail: 'malformed signature' };
  const key = keys.find((k) => k.kid === sig.kid);
  if (!key) return { ok: false, detail: `unknown key ${sig.kid} (not pinned)` };
  if (key.status === 'revoked') return { ok: false, detail: `key ${sig.kid} is revoked${key.revoked_at ? ` (${key.revoked_at})` : ''}` };
  const at = Date.parse(sig.issued_at);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(sig.issued_at) || Number.isNaN(at)) return { ok: false, detail: 'invalid issued_at' };
  if (key.not_before && at < Date.parse(key.not_before)) return { ok: false, detail: `issued before key ${sig.kid} was valid` };
  if (key.not_after && at > Date.parse(key.not_after)) return { ok: false, detail: `issued after key ${sig.kid} was retired` };
  if (!ed25519(message, sig.value, key.x)) return { ok: false, detail: 'Ed25519 signature does not match' };
  return { ok: true, detail: `Ed25519 valid, key ${sig.kid} (${key.status}), issued ${sig.issued_at}` };
}

export function verifyBundle(bundle: unknown, opts: VerifyOptions): Report {
  const checks: Check[] = [];
  const add = (id: string, status: CheckStatus, detail: string) => checks.push({ id, status, detail });
  let signature: Report['signature'] = 'unsigned';
  let unsupported = false;
  const finish = (sha: string | null, schema: string | null): Report => {
    const failed = checks.filter((c) => c.status === 'fail').map((c) => c.id).sort();
    return {
      verifier: VERIFIER,
      schema_version: schema,
      result: unsupported ? 'UNSUPPORTED' : failed.length ? 'INVALID' : 'VALID',
      signature,
      passport_sha256: sha,
      checks,
      failed,
      uncheckable: checks.filter((c) => c.status === 'uncheckable').map((c) => c.id).sort(),
    };
  };

  // 1. Schema
  if (!isObj(bundle) || bundle.bundle !== 'abrahammoses-decision-passport-bundle') {
    add('schema', 'fail', 'not a decision passport bundle');
    unsupported = true;
    return finish(null, null);
  }
  const schema = typeof bundle.schema_version === 'string' ? bundle.schema_version : null;
  if (!schema || !SUPPORTED_SCHEMAS.includes(schema)) {
    add('schema', 'fail', `unsupported schema_version ${schema} (supported: ${SUPPORTED_SCHEMAS.join(', ')})`);
    unsupported = true;
    return finish(null, schema);
  }
  const a = bundle.artifacts;
  const integ = bundle.integrity;
  const shapeOk =
    typeof bundle.passport_id === 'string' && typeof bundle.redacted === 'boolean' && isObj(a) && isObj(integ) && integ.algorithm === 'SHA-256' &&
    typeof integ.passport_sha256 === 'string' && /^[0-9a-f]{64}$/.test(integ.passport_sha256) && isObj(integ.artifacts) &&
    ARTIFACTS.every((n) => n in a && typeof integ.artifacts[n] === 'string') && Object.keys(integ.artifacts).length === ARTIFACTS.length &&
    isObj(a.passport) && typeof a.report_markdown === 'string' && isObj(a.state) && isObj(a.sources) && Array.isArray(a.sources.inventory) &&
    (a.sources.documents === null || Array.isArray(a.sources.documents)) && isObj(a.release) && isObj(a.review) && Array.isArray(a.review.attestations) && isObj(a.crypto);
  if (!shapeOk) {
    add('schema', 'fail', 'required fields missing or of the wrong type');
    return finish(null, schema);
  }
  add('schema', 'pass', `schema ${schema}`);

  // 2. Hashes
  const sha = digest(a.passport);
  add('passport_hash', sha === integ.passport_sha256 ? 'pass' : 'fail', sha === integ.passport_sha256 ? sha : `recomputed ${sha.slice(0, 12)}…, manifest says ${integ.passport_sha256.slice(0, 12)}…`);
  if (opts.expectedSha256) add('expected_hash', sha === opts.expectedSha256.toLowerCase() ? 'pass' : 'fail', `expected ${opts.expectedSha256.slice(0, 12)}…, recomputed ${sha.slice(0, 12)}…`);
  for (const n of ARTIFACTS) {
    const d = digest(a[n]);
    add(`artifact_hash:${n}`, d === integ.artifacts[n] ? 'pass' : 'fail', d === integ.artifacts[n] ? d : `recomputed ${d.slice(0, 12)}…, manifest says ${String(integ.artifacts[n]).slice(0, 12)}…`);
  }

  // 3. Integrity references between artifacts
  const id: string = bundle.passport_id;
  const cut = id.indexOf('.S-');
  const base = cut === -1 ? id : id.slice(0, cut);
  let idState: unknown = null;
  try {
    if (!base.startsWith('DP1-')) throw new Error('prefix');
    idState = b64urlJson(base.slice(4));
  } catch {
    idState = null;
  }
  add('ref:id_state', idState !== null && same(idState, a.state) ? 'pass' : 'fail', idState === null ? 'passport_id does not decode' : same(idState, a.state) ? 'passport_id encodes the state' : 'passport_id and state differ');
  add('ref:passport_id', a.passport.id === base ? 'pass' : 'fail', a.passport.id === base ? 'passport.id equals the ID' : 'passport.id differs from the ID');
  const { defaults, ...assumed } = isObj(a.passport.assumptions) ? a.passport.assumptions : ({} as Record<string, unknown>);
  void defaults;
  const stateOk = same(assumed, a.state.a) && a.passport.generated_at === a.state.t;
  add('ref:state_assumptions', stateOk ? 'pass' : 'fail', stateOk ? 'assumptions and time match the state' : 'passport assumptions or time differ from the state');
  add('ref:sources', same(a.passport.sources, a.sources.inventory) ? 'pass' : 'fail', same(a.passport.sources, a.sources.inventory) ? `${a.sources.inventory.length} sources` : 'source inventory differs from the passport');
  if (a.sources.documents === null) {
    add('source_documents', 'uncheckable', 'redacted export: source documents not included, their hashes cannot be recomputed');
  } else {
    const bad: string[] = [];
    for (const s of a.sources.inventory as Record<string, any>[]) {
      const doc = (a.sources.documents as Record<string, any>[]).find((d) => d.id === s.id);
      if (!doc || digest(doc) !== s.sha256) bad.push(s.id);
    }
    add('source_documents', bad.length ? 'fail' : 'pass', bad.length ? `hash mismatch or missing: ${bad.join(', ')}` : `${a.sources.inventory.length} documents recomputed`);
  }
  const r = a.release;
  const relProblems: string[] = [];
  if (a.passport.versions?.ruleset !== r.ruleset) relProblems.push('ruleset');
  if (a.passport.case?.version !== r.case_version || a.passport.case?.id !== r.case_id) relProblems.push('case version');
  if (a.passport.case?.content_sha256 !== undefined && a.passport.case.content_sha256 !== r.case_archive_sha256) relProblems.push('case archive hash');
  if (a.passport.engine !== undefined && !same(a.passport.engine, r.engine)) relProblems.push('engine');
  add('ref:release', relProblems.length ? 'fail' : 'pass', relProblems.length ? `passport and release manifest differ: ${relProblems.join(', ')}` : 'ruleset, case and engine match');
  if (!isObj(r.engine) || r.engine.sha256 === null || r.engine.sha256 === undefined) {
    add('engine_known', 'uncheckable', 'passport predates engine versioning (no engine digest)');
  } else {
    const known = opts.engines.some((e) => e.version === r.engine.version && e.sha256 === r.engine.sha256);
    if (!known) unsupported = true;
    add('engine_known', known ? 'pass' : 'fail', known ? `${r.engine.version} matches a pinned release` : `${r.engine.version} ${String(r.engine.sha256).slice(0, 12)}… is not a pinned release`);
  }
  // Compared by value (canonical JSON), as the spec and the Go verifier do: a reviewer may be an object, not only a string.
  const revOk = same(a.review.status, a.passport.status) && same(a.review.reviewer, a.passport.reviewer);
  add('ref:review', revOk ? 'pass' : 'fail', revOk ? `status and reviewer match (${a.review.attestations.length} attestations)` : 'review state differs from the passport');
  (a.review.attestations as unknown[]).forEach((att, i) => {
    if (!isObj(att) || !isObj(att.signature) || !isObj(att.statement)) return add(`attestation:${i}`, 'fail', 'attestation is not signed');
    const res = checkSig(`AbrahamMoses attestation v1\n${digest(att.statement)}\n${att.signature.kid}\n${att.signature.issued_at}`, att.signature, opts.keys);
    add(`attestation:${i}`, res.ok ? 'pass' : 'fail', res.detail);
  });

  // 4. Signature
  const sig = a.crypto.signature;
  let idSig: unknown = null;
  if (cut !== -1) {
    try {
      idSig = b64urlJson(id.slice(cut + 3));
    } catch {
      idSig = undefined;
    }
  }
  if (sig === null && cut === -1) {
    add('signature', 'pass', 'unsigned: integrity hash only (no issuer authentication)');
  } else if (!isObj(sig) || !same(sig, idSig)) {
    signature = 'invalid';
    add('signature', 'fail', 'signature in the bundle and in the passport ID differ');
  } else {
    const res = checkSig(issuanceMessage(sha, sig.kid, sig.issued_at), sig, opts.keys);
    if (res.ok && sig.issued_at !== a.state.t) {
      signature = 'invalid';
      add('signature', 'fail', 'issued_at differs from the passport time');
    } else {
      signature = res.ok ? 'valid' : 'invalid';
      add('signature', res.ok ? 'pass' : 'fail', res.detail);
    }
  }

  // 5. Revocation (only when a list is supplied)
  if (opts.revocations !== undefined) {
    const l = verifyRevocationList(opts.revocations, opts.keys);
    const hit = l.entries.find((e) => e.passport_sha256 === sha);
    if (hit) add('revocation', 'fail', `revoked ${hit.revoked_at} (${hit.reason}${hit.superseded_by ? `, superseded by ${hit.superseded_by.slice(0, 12)}…` : ''}); list ${l.status}`);
    else if (l.status === 'valid') add('revocation', 'pass', `not revoked: ${l.detail}`);
    else add('revocation', 'uncheckable', `revocation status not established: ${l.detail}`);
  }
  return finish(sha, schema);
}
