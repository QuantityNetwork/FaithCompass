/**
 * The Passport Policy: the versioned rules under which Decision Passports are drafted, reviewed, issued, kept and
 * revoked. Every passport names the policy version and the SHA-256 of this object (canonical JSON), so a reader can
 * tell exactly which text applied. A change of wording is a new version: never edit a published version in place;
 * add the next one and switch CURRENT_POLICY. docs/PASSPORT_POLICY.md is generated from this file
 * (`npx tsx scripts/passport-policy.ts`; tests/decision-passport.test.ts fails when it differs).
 *
 * Nothing here claims certification, legal validity, a qualified signature or regulatory approval.
 */
import { canonicalJson, sha256 } from '@/lib/decision/canonical';

export interface PolicySection {
  id: string;
  title: string;
  rules: string[];
}

export interface PassportPolicy {
  version: string;
  effective: string;
  status: string;
  operator: string;
  summary: string;
  sections: PolicySection[];
}

export const POLICY_1_0_0: PassportPolicy = {
  version: 'am-passport-policy/1.0.0',
  effective: '2026-10-21',
  status: 'In force for passports drafted on this site. Not reviewed by a lawyer. Not a certification scheme.',
  operator: 'Sagolik, Halmstad, Sweden',
  summary:
    'A Decision Passport attests to process and evidence integrity: which sealed analysis it is bound to, which findings and passages it carries, which engine and model produced them, who proposed and who reviewed it under the two-person rule, and when. It does not attest that any finding or conclusion is legally or factually correct.',
  sections: [
    {
      id: 'scope',
      title: 'Scope and meaning',
      rules: [
        'A passport is a signed record of a process. It does not attest that any finding, rating or conclusion is legally or factually correct, and it is not legal advice.',
        'A passport has no legal validity of its own. Its signature is an integrity signature by the operator; it is not a qualified electronic signature or seal, and the operator is not a trust service provider.',
        'No certification, accreditation or regulatory approval is claimed for passports, for the issuing process or for the operator.',
      ],
    },
    {
      id: 'attestable',
      title: 'What may be attested',
      rules: [
        'Only content bound to a sealed source: a Deep Analysis report whose SHA-256 seal verifies, or a decision record built by a pinned engine.',
        'Findings are carried with the spans they cite; every span quote must hash to its recorded SHA-256. Findings whose spans do not verify are refused at drafting.',
        'The analysis engine version and, when the AI layer ran, its provider, model and prompt version are recorded. AI output is labelled as such and is never presented as human review.',
        'Personal data is kept to account ids. An email address is shown only with the consent of its holder, given at the step that person performs.',
        'Absence findings state what was searched for and are anchored to the text hash; they are not proof that something does not exist elsewhere.',
      ],
    },
    {
      id: 'issuance',
      title: 'Issuance rules',
      rules: [
        'Lifecycle: draft → submitted → approved or rejected → issued; an issued passport may later be revoked or superseded. No step can be skipped or undone.',
        'Any member of the workspace may create a draft and submit it. Only a different member holding the workspace role editor may approve or reject it (two-person rule); self-approval is refused by the server and by the database rules.',
        'Only an approved draft can be issued, by its proposer or its reviewer. The server builds the passport from the stored record and signs it with the operator key; no client ever holds the key.',
        'Issuance is refused when no signing key is configured: there are no unsigned issued passports. Draft records can be exported unsigned and are labelled DRAFT.',
        'Each issued passport is registered by its SHA-256 in the public registry, with its key id and issue time only; its content stays in the workspace.',
      ],
    },
    {
      id: 'audit',
      title: 'Audit trail',
      rules: [
        'Every step (drafted, submitted, approved, rejected, issued, revoked) is written to the workspace audit log in the same database transaction as the change it records. The log is append-only: no update or delete is allowed by the rules.',
        'The audit trail of a passport up to its issue is included in the passport itself and covered by its hash and signature.',
      ],
    },
    {
      id: 'retention',
      title: 'Retention',
      rules: [
        'Drafts, issued passports and their audit trail are kept for as long as the workspace exists, and at least as long as the operator offers verification for them.',
        'Registry and revocation entries are public, are never deleted and are kept for as long as verification is offered, so that a revoked passport cannot quietly become valid again.',
        'The analysed document text is not stored with a passport; only its hashes and the quoted spans are. Deleting a workspace deletes its drafts and passports; registry and revocation entries remain.',
      ],
    },
    {
      id: 'revocation',
      title: 'Revocation and supersession',
      rules: [
        'An editor of the issuing workspace may revoke an issued passport, giving a reason: superseded, withdrawn, error or key-compromise. Revocation is permanent.',
        'A correction is a new passport that names the passport it supersedes; the old passport is then revoked with the reason superseded and a pointer to its successor.',
        'The revocation list is public and signed with the operator key, so it can be checked offline. A verifier that cannot obtain the list must report revocation status as not checked, never as not revoked.',
      ],
    },
    {
      id: 'keys',
      title: 'Key management',
      rules: [
        'Passports are signed with Ed25519. The private key exists only as a sensitive server environment variable of the production deployment; it is never logged, returned, committed or available to previews.',
        'Public keys are published at /.well-known/abrahammoses-passport-keys.json and pinned in the offline verifier. A key id is derived from the public key (ed25519- + the first 16 hex digits of its SHA-256).',
        'Rotation: the outgoing key is listed as retired with its validity window and is never removed, so earlier passports keep verifying; the new key starts a new window.',
        'Compromise: the key is listed as revoked with the time of revocation; signatures by it are then rejected by every verifier, and affected passports are re-issued under a new key.',
      ],
    },
    {
      id: 'incident',
      title: 'Incident process',
      rules: [
        'Suspected key exposure, a wrongly issued passport or a verification defect is an incident. Report it through the contact address published on this site.',
        'Without undue delay after becoming aware: contain (disable signing by removing the key from the deployment), assess which passports are affected, and record the incident.',
        'Remediate: revoke affected passports or keys, rotate the key, re-issue where appropriate, and publish a short notice listing affected passport hashes and the action taken.',
        'Review: record the cause and the change made to prevent recurrence. Where personal data is affected, the operator applies its data-protection obligations separately.',
      ],
    },
  ],
};

export const CURRENT_POLICY = POLICY_1_0_0;
export const POLICY_VERSIONS: readonly PassportPolicy[] = [POLICY_1_0_0];

export const policyDigest = (p: PassportPolicy = CURRENT_POLICY) => sha256(canonicalJson(p));

/** The policy reference every passport carries. */
export const policyRef = (p: PassportPolicy = CURRENT_POLICY) => ({ version: p.version, sha256: policyDigest(p) });

/** A known policy version and its digest, or null. */
export function knownPolicy(version: unknown, digest: unknown): PassportPolicy | null {
  const p = POLICY_VERSIONS.find((x) => x.version === version);
  return p && policyDigest(p) === digest ? p : null;
}

/** The Markdown rendering of a policy (docs/PASSPORT_POLICY.md). */
export function policyMarkdown(p: PassportPolicy = CURRENT_POLICY): string {
  const out = [
    `# Passport Policy (${p.version})`,
    '',
    `Effective ${p.effective}. ${p.status}`,
    '',
    `Operator: ${p.operator}. Policy SHA-256 (canonical JSON of \`src/lib/passport/policy.ts\`): \`${policyDigest(p)}\`.`,
    '',
    p.summary,
    '',
    '_Generated from src/lib/passport/policy.ts by scripts/passport-policy.ts. Do not edit by hand._',
    '',
  ];
  p.sections.forEach((s, i) => {
    out.push(`## ${i + 1}. ${s.title}`, '');
    s.rules.forEach((r, j) => out.push(`${i + 1}.${j + 1} ${r}`, ''));
  });
  return out.join('\n');
}
