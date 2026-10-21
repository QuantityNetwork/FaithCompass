/**
 * The optional Deep Analysis profile: organisation, role and an opt-in to be contacted about a Decision Room pilot.
 * Stored at `user_profiles/{uid}` in Firestore, readable and writable only by that user (firestore.rules); the
 * operator reads it with project IAM (scripts/export-leads.mjs). The rules repeat every check below.
 */

export const PROFILE_COLLECTION = 'user_profiles';
/** Bump when the consent wording changes; stored with each profile so the text a user agreed to is known. */
export const CONSENT_VERSION = 'pilot-contact-1';
export const PILOT_CONSENT_TEXT = 'I’d like to talk about a Decision Room pilot. You may email me about it.';
export const PROFILE_SOURCE = 'deep-analysis';
export const ORG_MAX = 160;

export const ROLES = [
  { id: 'credit_risk', label: 'Credit / Risk' },
  { id: 'model_risk_ai_governance', label: 'Model risk / AI governance' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'legal_gc', label: 'Legal / General Counsel' },
  { id: 'other', label: 'Other' },
] as const;
export type RoleId = (typeof ROLES)[number]['id'];
export const ROLE_IDS = ROLES.map((r) => r.id) as readonly RoleId[];
export const roleLabel = (id: string) => ROLES.find((r) => r.id === id)?.label ?? id;

export interface ProfileInput {
  organisation: string;
  role: RoleId | '';
  pilotInterest: boolean;
}

/** The fields a client writes (timestamps are set by the server clock, request.time, in the rules). */
export interface ProfileFields {
  organisation: string;
  role: RoleId;
  pilotInterest: boolean;
  consentVersion: string;
  privacyVersion: string;
  email: string | null;
  source: typeof PROFILE_SOURCE;
}

export type ProfileCheck = { ok: true; fields: ProfileFields } | { ok: false; field: 'organisation' | 'role'; message: string };

/** Normalises and validates what the user typed. `email` is the verified address from the ID token, or null. */
export function checkProfile(input: ProfileInput, email: string | null, privacyVersion: string): ProfileCheck {
  const organisation = input.organisation.replace(/\s+/g, ' ').trim();
  if (!organisation) return { ok: false, field: 'organisation', message: 'Enter your organisation.' };
  if (organisation.length > ORG_MAX) return { ok: false, field: 'organisation', message: `Use at most ${ORG_MAX} characters.` };
  if (!ROLE_IDS.includes(input.role as RoleId)) return { ok: false, field: 'role', message: 'Choose your role.' };
  return {
    ok: true,
    fields: { organisation, role: input.role as RoleId, pilotInterest: input.pilotInterest === true, consentVersion: CONSENT_VERSION, privacyVersion, email, source: PROFILE_SOURCE },
  };
}
