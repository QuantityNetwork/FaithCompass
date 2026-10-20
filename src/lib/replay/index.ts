/**
 * Historical replay of Decision Passports: three distinct operations.
 *
 * 1. `verifyOperation`: is the passport unchanged? Rebuilds it from its ID with the archived case and the frozen
 *    engine it names and compares the SHA-256 (the existing `verifyPassport`), plus the issued signature.
 * 2. `deterministicReplay`: can the decision be reproduced from preserved inputs? Checks every component against
 *    pinned digests (each source document, the ruleset, the case archive, the engine registration and, when its
 *    files are supplied, the engine source), then rebuilds. Status REPRODUCED / MISMATCH / TAMPERED /
 *    UNSUPPORTED_VERSION / INCOMPLETE. A missing component is INCOMPLETE, never a pass.
 * 3. `historicalAiReview`: re-running the AI review as it was. NOT_APPLICABLE: the Decision Twin uses no AI model.
 *
 * `replayUnderEngine` additionally re-evaluates a passport's preserved inputs with another engine release (e.g. the
 * active one) and compares every node with the engine that issued it.
 */
import { hashOf, sha256 } from '@/lib/decision/canonical';
import { engineSourceHash, ENGINE_FOR_CASE } from '@/lib/decision/engines';
import { fingerprint, type Evaluation } from '@/lib/decision/engines/v1/engine';
import type { Assumptions } from '@/lib/decision/engines/v1/engine';
import { CASE_ARCHIVE, PassportIdError, UnsupportedVersionError, buildPassport, decodePassport, verifyPassport, type CaseArchive } from '@/lib/decision/passport';
import { archiveHash } from '@/lib/decision/versions';

/** Per-component digests pinned for each archived case version. Never edit; add a version. */
export const REPLAY_MANIFEST: Record<string, { ruleset: string; documents: Record<string, string> }> = {
  '1.0.0': {
    ruleset: 'dr-rules-1.0.0',
    documents: {
      'DOC-01': '7881d86346c9d53f53394f8d8fc0a11c2894afcb1f9e7de1eae3a72a3275ecce',
      'DOC-02': '73232bfd86a0b96421c4fb92cb7f23b87b74a196a20039a3950a45da60326dbe',
      'DOC-03': '64263f2e0991c11054d155fd0a73d6bdd6d7ac2eeeb72d882afd37a6ee2789c0',
      'DOC-04': '8236b02741ff274abab84e6953928588006978230f5797c71ec7dbaf345c4af0',
      'DOC-05': 'afbe7848997bde0c17d343813557342ee5930d20997171feece2be843676cecc',
      'DOC-06': 'f154d4cb10fe370e2f14d6112187538ece31f995b470d46eaf2cfe5a9ab86e34',
      'DOC-07': '34230621b4ea44c49e25d862b76db8ad6560942d69eb31f4da90944d414aa9b9',
      'DOC-08': '6abc6a976c8978285cb5e92c5b214539277b8e9230357e4b0ee64f66b1b0ee78',
      'DOC-09': '4ffc6959a461b51972ba1a9dbcb23f6766c34007fb3ccaf040da663022cdd14d',
      'DOC-10': 'e39ad77e7b361167a3349664bc0f743164167275d873b8fdea0b0016c2fa45e5',
    },
  },
};

export type ComponentStatus = 'ok' | 'tampered' | 'missing' | 'not_checked';
export interface ComponentCheck {
  component: string;
  status: ComponentStatus;
  detail: string;
}

export interface ReplayEnv {
  archive?: CaseArchive;
  manifest?: typeof REPLAY_MANIFEST;
  /** Engine source files by engine key, to check the engine digest. Without them the replay is INCOMPLETE. */
  engineSources?: Record<string, Record<string, string>>;
}

/* ----------------------------------------------------------------- verify */

export function verifyOperation(id: string, hash: string, env: ReplayEnv = {}) {
  const archive = env.archive ?? CASE_ARCHIVE;
  try {
    const r = verifyPassport(id, hash, { archive });
    const p = buildPassport(id, { archive });
    return { operation: 'verify' as const, status: r.valid ? ('VALID' as const) : ('INVALID' as const), sha256: hash.toLowerCase(), expected: r.expected, signature: p.integrity.signature.status === 'signed' ? (p.integrity.signature.valid ? 'valid' : 'invalid') : 'unsigned', engine: p.integrity.engine.version };
  } catch (err) {
    if (err instanceof UnsupportedVersionError) return { operation: 'verify' as const, status: 'UNSUPPORTED_VERSION' as const, sha256: hash.toLowerCase(), expected: null, signature: null, engine: null, detail: err.message };
    if (err instanceof PassportIdError) return { operation: 'verify' as const, status: 'INVALID' as const, sha256: hash.toLowerCase(), expected: null, signature: null, engine: null, detail: err.message };
    if (err instanceof Error && /pinned hash/.test(err.message)) return { operation: 'verify' as const, status: 'TAMPERED' as const, sha256: hash.toLowerCase(), expected: null, signature: null, engine: null, detail: err.message };
    throw err;
  }
}

/* ------------------------------------------------------- deterministic replay */

export type ReplayStatus = 'REPRODUCED' | 'MISMATCH' | 'TAMPERED' | 'UNSUPPORTED_VERSION' | 'INCOMPLETE';

export function deterministicReplay(id: string, hash: string, env: ReplayEnv = {}) {
  const archive = env.archive ?? CASE_ARCHIVE;
  const manifest = env.manifest ?? REPLAY_MANIFEST;
  const checks: ComponentCheck[] = [];
  const done = (status: ReplayStatus, rebuilt: string | null = null, detail?: string) => ({ operation: 'deterministic_replay' as const, status, sha256: hash.toLowerCase(), rebuiltSha256: rebuilt, checks, ...(detail ? { detail } : {}) });

  let decoded;
  try {
    decoded = decodePassport(id, archive);
  } catch (err) {
    if (err instanceof UnsupportedVersionError) return done('UNSUPPORTED_VERSION', null, err.message);
    throw err;
  }
  const { state } = decoded;
  const entry = archive.versions[state.caseVersion];
  const pinned = manifest[state.caseVersion];
  if (!pinned) checks.push({ component: 'manifest', status: 'missing', detail: `no replay manifest for case version ${state.caseVersion}` });
  else {
    for (const [docId, digest] of Object.entries(pinned.documents)) {
      const d = entry.data.documents.find((x) => x.id === docId);
      if (!d) checks.push({ component: `source:${docId}`, status: 'missing', detail: 'document not in the archive' });
      else checks.push({ component: `source:${docId}`, status: hashOf(d) === digest ? 'ok' : 'tampered', detail: hashOf(d) === digest ? digest : `expected ${digest.slice(0, 12)}…, found ${hashOf(d).slice(0, 12)}…` });
    }
    for (const d of entry.data.documents) if (!pinned.documents[d.id]) checks.push({ component: `source:${d.id}`, status: 'tampered', detail: 'document not in the pinned manifest' });
    checks.push({ component: 'ruleset', status: entry.data.ruleset === pinned.ruleset ? 'ok' : 'tampered', detail: entry.data.ruleset === pinned.ruleset ? pinned.ruleset : `expected ${pinned.ruleset}, found ${entry.data.ruleset}` });
  }
  const archiveOk = archiveHash(entry.data) === entry.sha256;
  checks.push({ component: 'case_archive', status: archiveOk ? 'ok' : 'tampered', detail: archiveOk ? entry.sha256 : 'archived case data does not match its pinned hash' });

  const engineKey = state.e ?? ENGINE_FOR_CASE[state.caseVersion];
  const engine = engineKey ? archive.engines[engineKey] : undefined;
  if (!engine) checks.push({ component: 'engine', status: 'missing', detail: `engine ${engineKey ?? '(none)'} is not registered` });
  else {
    const files = env.engineSources?.[engineKey!];
    if (!files) checks.push({ component: 'engine_source', status: 'missing', detail: `source files of ${engine.version} were not supplied; its digest cannot be checked` });
    else {
      const got = engineSourceHash(files, sha256);
      checks.push({ component: 'engine_source', status: got === engine.sha256 ? 'ok' : 'tampered', detail: got === engine.sha256 ? `${engine.version} ${engine.sha256}` : `expected ${engine.sha256.slice(0, 12)}…, found ${got.slice(0, 12)}…` });
    }
  }
  if (checks.some((c) => c.status === 'tampered')) return done('TAMPERED');
  if (checks.some((c) => c.status === 'missing')) return done('INCOMPLETE');
  const r = verifyPassport(id, hash, { archive });
  return done(r.valid ? 'REPRODUCED' : 'MISMATCH', r.expected);
}

/* ------------------------------------------------------ historical AI review */

export function historicalAiReview(id: string, env: ReplayEnv = {}) {
  const archive = env.archive ?? CASE_ARCHIVE;
  const p = buildPassport(id, { archive });
  return {
    operation: 'historical_ai_review' as const,
    status: 'NOT_APPLICABLE' as const,
    model: p.versions.model,
    reason: 'Not applicable: no AI was used. The passport was produced by deterministic rules only, so there is no model, prompt or AI output to replay.',
  };
}

/* ---------------------------------------------------- replay under an engine */

export interface EngineRelease {
  key: string;
  version: string;
  sha256: string | null;
  evaluate: (a: Assumptions) => Evaluation;
}

/** Re-evaluate the passport's preserved inputs with `target` and compare every node with `issuer`. */
export function replayUnderEngine(id: string, issuer: EngineRelease, target: EngineRelease, env: ReplayEnv = {}) {
  const { state } = decodePassport(id, env.archive ?? CASE_ARCHIVE);
  const original = issuer.evaluate(state.a);
  const replayed = target.evaluate(state.a);
  const ids = [...new Set([...Object.keys(original), ...Object.keys(replayed)])];
  const differing = ids
    .filter((n) => !original[n] || !replayed[n] || fingerprint(original[n]) !== fingerprint(replayed[n]) || (original[n].status ?? null) !== (replayed[n].status ?? null))
    .map((n) => ({ node: n, issuer: original[n]?.display ?? null, target: replayed[n]?.display ?? null }));
  return {
    operation: 'replay_under_engine' as const,
    issuer: { version: issuer.version, sha256: issuer.sha256 },
    target: { version: target.version, sha256: target.sha256 },
    compared: ids.length,
    identical: ids.length - differing.length,
    differing,
    conclusionIdentical: !differing.some((d) => d.node === 'conclusion'),
  };
}
