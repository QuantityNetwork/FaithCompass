/**
 * Deep Analysis Decision Passports: bind a sealed Deep Analysis report to a passport draft, and export the draft (or
 * the issued passport) as a passport bundle, schema 1.0.0, verifiable by both verifiers with no change to either (the
 * record engine am-da-passport-1.0.0 is a pinned release). Only an issued draft is ever signed, and only here, with the
 * server's key; the issue time is the signature time (issued_at == state.t).
 */
import { canonicalJson } from '@/lib/decision/canonical';
import { ENGINES } from '@/lib/decision/engines';
import { PASSPORT_PREFIX, SIGNATURE_SEPARATOR } from '@/lib/decision/passport';
import { KEYS_PATH, configuredSigner, keyRegistry, type IssuedSignature, type SignerState } from '@/lib/decision/signing';
import { verifyBundle as verifyDeepBundle } from '@/lib/deep-analysis/bundle';
import type { Report as DeepReport } from '@/lib/deep-analysis/schema';
import { ARTIFACT_NAMES, BUNDLE_KIND, BUNDLE_SCHEMA_VERSION, CANONICALIZATION, digest } from '@/lib/passport-bundle/bundle';
import { REVOCATION_LIST_KIND, revocationListDigest, type RevocationEntry } from '@/lib/passport-bundle/verify';
import { policyRef } from './policy';
import { buildRecord, recordState, type Binding, type RecordAuditEvent, type RecordDraft, type RecordInput } from './record/v1/build';

export const DA_PASSPORT_ENGINE_KEY = 'deep-analysis-passport-1.0.0';
/** Firestore documents are limited to 1 MiB; the binding is stored as one string field. */
export const MAX_BINDING_BYTES = 700_000;

export function daPassportEngine() {
  const e = ENGINES[DA_PASSPORT_ENGINE_KEY];
  return { version: e.version, sha256: e.sha256, source: e.source };
}

export type BindResult = { ok: true; binding: Binding; json: string; sha256: string } | { ok: false; problems: string[] };

/**
 * Bind a Deep Analysis bundle. The bundle is re-verified first (report seal and every span against the text); a
 * bundle that fails is refused. Only what the passport needs is kept: no document text, only cited spans.
 * `showFilename`: the file name is kept only with consent (it can be personal data).
 */
export function bindDeepAnalysis(bundle: unknown, opts: { showFilename: boolean }): BindResult {
  const check = verifyDeepBundle(bundle);
  if (!check.ok) return { ok: false, problems: check.problems.slice(0, 10) };
  const r = (bundle as { report: DeepReport }).report;
  const ids = new Set(r.spans.map((s) => s.id));
  const findings = r.findings.map((f) => ({
    id: f.id,
    section: f.section,
    layer: f.layer,
    title: f.title,
    detail: f.detail,
    severity: f.severity ?? null,
    requiresHumanReview: f.requiresHumanReview,
    spans: f.spans,
    absence: f.absence ?? null,
  }));
  const problems = findings.flatMap((f) => f.spans.filter((s) => !ids.has(s)).map((s) => `finding ${f.id} cites missing span ${s}`));
  if (problems.length) return { ok: false, problems };
  const cited = new Set([...findings.flatMap((f) => f.spans), ...r.finalStatement.overallSpans, ...r.finalStatement.recommendedActions.flatMap((a) => a.spans)]);
  const binding: Binding = {
    title: r.overview.title || r.document.filename,
    reportSha256: r.seal.reportSha256,
    reportSchema: r.schema,
    analysedAt: r.generatedAt,
    document: {
      filename: opts.showFilename ? r.document.filename : null,
      format: r.document.format,
      bytes: r.document.bytes,
      fileSha256: r.document.bytesSha256,
      textSha256: r.document.textSha256,
      chars: r.document.chars,
      pages: r.document.pages,
      extraction: r.document.extraction ?? 'server',
    },
    analysisEngine: {
      version: r.engine.version,
      ai: { status: r.engine.ai.status, provider: r.engine.ai.provider, model: r.engine.ai.model, promptVersion: r.engine.ai.promptVersion },
    },
    outcome: {
      rating: r.finalStatement.rating,
      confidence: r.finalStatement.confidence,
      overall: r.finalStatement.overall,
      overallSpans: r.finalStatement.overallSpans,
      recommendedActions: r.finalStatement.recommendedActions.map((a) => ({ text: a.text, spans: a.spans })),
    },
    findings,
    spans: r.spans.filter((s) => cited.has(s.id)).map((s) => ({ id: s.id, start: s.start, end: s.end, sha256: s.sha256, quote: s.quote })),
  };
  if (!opts.showFilename && binding.title === r.document.filename) binding.title = 'Untitled document';
  const json = canonicalJson(binding);
  if (Buffer.byteLength(json, 'utf8') > MAX_BINDING_BYTES) return { ok: false, problems: [`the report is too large to bind (more than ${MAX_BINDING_BYTES} bytes of findings and spans)`] };
  return { ok: true, binding, json, sha256: digest(binding) };
}

export interface DaExportInput {
  tenant: string;
  draft: RecordDraft;
  audit: RecordAuditEvent[];
  /** Required to sign; ignored (never signs) unless draft.status is 'issued'. */
  signer?: SignerState;
  /** Rebuilding a stored issued passport: reuse its issuance signature instead of signing again. */
  signature?: IssuedSignature;
}

export function buildDaPassportBundle(input: DaExportInput) {
  const issued = input.draft.status === 'issued';
  const signer = issued && !input.signature ? (input.signer ?? configuredSigner()) : ({ status: 'unsigned' } as SignerState);
  if (issued && !input.signature && signer.status !== 'signing') throw new Error('SIGNING_UNAVAILABLE');
  const rec: RecordInput = { tenant: input.tenant, draft: input.draft, audit: input.audit, engine: daPassportEngine(), policy: policyRef() };
  const state = recordState(rec);
  const baseId = PASSPORT_PREFIX + Buffer.from(canonicalJson(state), 'utf8').toString('base64url');
  const r = buildRecord(baseId, rec);
  const passportSha = digest(r.passport);
  let signature: IssuedSignature | null = null;
  if (issued && input.signature) signature = input.signature;
  else if (signer.status === 'signing') signature = { alg: 'Ed25519', kid: signer.signer.keyId, issued_at: state.t, value: signer.signer.signIssuance(passportSha, state.t) };
  const passportId = signature ? baseId + SIGNATURE_SEPARATOR + Buffer.from(canonicalJson(signature), 'utf8').toString('base64url') : baseId;
  const artifacts = {
    passport: r.passport,
    report_markdown: r.report_markdown,
    state: r.state,
    sources: r.sources,
    release: r.release,
    review: r.review,
    crypto: { signature, algorithm: signature ? 'Ed25519' : null, keys_url: KEYS_PATH, keys: input.signature ? keyRegistry() : keyRegistry(signer) },
  };
  return {
    bundle: BUNDLE_KIND,
    schema_version: BUNDLE_SCHEMA_VERSION,
    redacted: false,
    passport_id: passportId,
    artifacts,
    integrity: {
      algorithm: 'SHA-256',
      canonicalization: CANONICALIZATION,
      passport_sha256: passportSha,
      artifacts: Object.fromEntries(ARTIFACT_NAMES.map((n) => [n, digest(artifacts[n])])) as Record<(typeof ARTIFACT_NAMES)[number], string>,
    },
  };
}
export type DaPassportBundle = ReturnType<typeof buildDaPassportBundle>;

export const daBundleFileName = (b: DaPassportBundle) =>
  `decision-passport-${b.artifacts.passport.status === 'issued' ? '' : 'DRAFT-'}${b.integrity.passport_sha256.slice(0, 12)}.bundle.json`;

/** Build the public revocation list, signed with the server key when one is configured. */
export function buildRevocationList(entries: RevocationEntry[], generatedAt: string, signer: SignerState = configuredSigner()) {
  const sorted = [...entries].sort((a, b) => (a.revoked_at < b.revoked_at ? -1 : a.revoked_at > b.revoked_at ? 1 : a.passport_sha256 < b.passport_sha256 ? -1 : 1));
  const body = { object: REVOCATION_LIST_KIND, version: 1, generated_at: generatedAt, entries: sorted };
  const listSha = revocationListDigest(body);
  const signature =
    signer.status === 'signing' && signer.signer.signRevocationList
      ? { alg: 'Ed25519' as const, kid: signer.signer.keyId, issued_at: generatedAt, value: signer.signer.signRevocationList(listSha, generatedAt) }
      : null;
  return { ...body, list_sha256: listSha, signature, signed_message: 'UTF-8 bytes of "AbrahamMoses revocation list v1\\n" + list_sha256 + "\\n" + kid + "\\n" + issued_at', keys_url: KEYS_PATH };
}
