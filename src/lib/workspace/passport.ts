/**
 * Export a workspace decision as a Decision Passport bundle (schema 1.0.0), verifiable offline by both the TypeScript
 * and the Go verifier (packages/decision-verifier) with no change to either: the record engine
 * `am-workspace-record-1.0.0` is a pinned release like the Decision Twin engines.
 *
 * Signed with the server's passport key when one is configured (production); unsigned otherwise (previews), in which
 * case the bundle proves consistency only, as for any unsigned passport.
 */
import { canonicalJson } from '@/lib/decision/canonical';
import { ENGINES } from '@/lib/decision/engines';
import { PASSPORT_PREFIX, SIGNATURE_SEPARATOR } from '@/lib/decision/passport';
import { KEYS_PATH, configuredSigner, keyRegistry, type IssuedSignature, type SignerState } from '@/lib/decision/signing';
import { ARTIFACT_NAMES, BUNDLE_KIND, BUNDLE_SCHEMA_VERSION, CANONICALIZATION, digest } from '@/lib/passport-bundle/bundle';
import type { WorkspaceAuditEvent, WorkspaceDecision, WorkspaceDocument } from './model';
import { buildRecord, recordState, type RecordInput } from './record/v1/build';

export const WORKSPACE_ENGINE_KEY = 'workspace-1.0.0';

export function workspaceEngine() {
  const e = ENGINES[WORKSPACE_ENGINE_KEY];
  return { version: e.version, sha256: e.sha256, source: e.source };
}

export interface ExportInput {
  tenant: string;
  decision: WorkspaceDecision;
  documents: WorkspaceDocument[];
  audit: WorkspaceAuditEvent[];
  redacted?: boolean;
  signer?: SignerState;
}

export function buildWorkspaceBundle(input: ExportInput) {
  const signer = input.signer ?? configuredSigner();
  const rec: RecordInput = { tenant: input.tenant, decision: input.decision, documents: input.documents, audit: input.audit, engine: workspaceEngine() };
  const state = recordState(rec);
  const baseId = PASSPORT_PREFIX + Buffer.from(canonicalJson(state), 'utf8').toString('base64url');
  const r = buildRecord(baseId, rec);
  const passportSha = digest(r.passport);
  let signature: IssuedSignature | null = null;
  if (signer.status === 'signing') {
    signature = { alg: 'Ed25519', kid: signer.signer.keyId, issued_at: state.t, value: signer.signer.signIssuance(passportSha, state.t) };
  }
  const passportId = signature ? baseId + SIGNATURE_SEPARATOR + Buffer.from(canonicalJson(signature), 'utf8').toString('base64url') : baseId;
  const keys = keyRegistry(signer);
  const artifacts = {
    passport: r.passport,
    report_markdown: r.report_markdown,
    state: r.state,
    sources: { inventory: r.sources.inventory, documents: input.redacted ? null : r.sources.documents },
    release: r.release,
    review: r.review,
    crypto: { signature, algorithm: signature ? 'Ed25519' : null, keys_url: KEYS_PATH, keys },
  };
  return {
    bundle: BUNDLE_KIND,
    schema_version: BUNDLE_SCHEMA_VERSION,
    redacted: !!input.redacted,
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

export type WorkspaceBundle = ReturnType<typeof buildWorkspaceBundle>;

export function workspaceBundleFileName(b: WorkspaceBundle) {
  return `workspace-decision-${b.integrity.passport_sha256.slice(0, 12)}${b.redacted ? '-redacted' : ''}.bundle.json`;
}
