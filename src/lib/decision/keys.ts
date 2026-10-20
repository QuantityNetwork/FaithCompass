/**
 * Retired Decision Passport public keys. Public keys are not secret; they are committed so the record of which key
 * was valid when is reviewable in git. On compromise: set status 'revoked' and revoked_at. On rotation: append the outgoing key here with status 'retired' and its
 * not_after (the rotation time), then set the new PASSPORT_SIGNING_KEY. Never remove an entry.
 */
export interface PublishedKey {
  kid: string;
  /** Raw 32-byte Ed25519 public key, base64url (JWK "x"). */
  x: string;
  /** 'revoked': the key must not be trusted at all (e.g. compromised); every signature by it is invalid. */
  status: 'active' | 'retired' | 'revoked';
  not_before: string | null;
  not_after: string | null;
  /** When the key was revoked (status 'revoked' only). */
  revoked_at?: string | null;
}

/**
 * The active production key (kid ed25519-e31c2d82da92a114, from 2026-10-20T21:30:00Z) is published at runtime from
 * PASSPORT_SIGNING_KEY and pinned for verifiers in packages/decision-verifier/keys/production.json. None retired yet.
 */
export const HISTORICAL_KEYS: readonly PublishedKey[] = [];
