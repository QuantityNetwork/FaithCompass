/**
 * Portable Decision Passport bundle (schema 1.0.0): everything needed to check a passport offline, in one JSON file.
 * See docs/DECISION_PASSPORT_SPEC.md. Built from the existing passport builder; nothing is re-derived here.
 */
import { canonicalJson, sha256 } from '@/lib/decision/canonical';
import { CASE_ARCHIVE, buildPassport, decodePassport, passportMarkdown, type CaseArchive } from '@/lib/decision/passport';
import type { PublishedKey } from '@/lib/decision/keys';
import { KEYS_PATH, keyRegistry } from '@/lib/decision/signing';

export const BUNDLE_KIND = 'abrahammoses-decision-passport-bundle';
export const BUNDLE_SCHEMA_VERSION = '1.0.0';
export const ARTIFACT_NAMES = ['passport', 'report_markdown', 'state', 'sources', 'release', 'review', 'crypto'] as const;
export const CANONICALIZATION =
  'canonical-json/1: object keys sorted by UTF-16 code units, no whitespace, strings and numbers as ECMAScript JSON.stringify (RFC 8785 JCS-compatible for these values), undefined members omitted';

export const digest = (v: unknown) => sha256(canonicalJson(v));

export interface BundleOptions {
  redacted?: boolean;
  archive?: CaseArchive;
  keys?: readonly PublishedKey[];
}

export function buildBundle(id: string, opts: BundleOptions = {}) {
  const archive = opts.archive ?? CASE_ARCHIVE;
  const keys = opts.keys ?? keyRegistry();
  const p = buildPassport(id, { archive, keys });
  const { passport_id, integrity, ...content } = p;
  const decoded = decodePassport(id, archive);
  const entry = archive.versions[decoded.state.caseVersion];
  const artifacts = {
    passport: content,
    report_markdown: passportMarkdown(p),
    state: decoded.state,
    sources: {
      inventory: content.sources,
      // The source documents themselves; omitted in a redacted export (the verifier then reports them uncheckable).
      documents: opts.redacted ? null : entry.data.documents,
    },
    release: {
      case_id: entry.data.case.id,
      case_version: entry.data.version,
      case_archive_sha256: entry.sha256,
      ruleset: entry.data.ruleset,
      engine: integrity.engine,
    },
    review: {
      status: content.status,
      reviewer: content.reviewer,
      // No human attestation exists for this synthetic case.
      attestations: [] as unknown[],
    },
    crypto: {
      signature: decoded.signature,
      algorithm: decoded.signature ? 'Ed25519' : null,
      keys_url: KEYS_PATH,
      // Informational copy of the published keys. A verifier must use keys it pinned independently, never these.
      keys,
    },
  };
  return {
    bundle: BUNDLE_KIND,
    schema_version: BUNDLE_SCHEMA_VERSION,
    redacted: !!opts.redacted,
    passport_id,
    artifacts,
    integrity: {
      algorithm: 'SHA-256',
      canonicalization: CANONICALIZATION,
      passport_sha256: integrity.sha256,
      artifacts: Object.fromEntries(ARTIFACT_NAMES.map((n) => [n, digest(artifacts[n])])) as Record<(typeof ARTIFACT_NAMES)[number], string>,
    },
  };
}

export type PassportBundle = ReturnType<typeof buildBundle>;

export function bundleFileName(b: PassportBundle) {
  return `decision-passport-${b.integrity.passport_sha256.slice(0, 12)}${b.redacted ? '-redacted' : ''}.bundle.json`;
}
