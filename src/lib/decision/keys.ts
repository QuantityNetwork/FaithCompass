/**
 * Retired Decision Passport public keys. Public keys are not secret; they are committed so the record of which key
 * was valid when is reviewable in git. On rotation: append the outgoing key here with status 'retired' and its
 * not_after (the rotation time), then set the new PASSPORT_SIGNING_KEY. Never remove an entry.
 */
export interface PublishedKey {
  kid: string;
  /** Raw 32-byte Ed25519 public key, base64url (JWK "x"). */
  x: string;
  status: 'active' | 'retired';
  not_before: string | null;
  not_after: string | null;
}

/** No key has been configured in production yet, so none has been retired. */
export const HISTORICAL_KEYS: readonly PublishedKey[] = [];
