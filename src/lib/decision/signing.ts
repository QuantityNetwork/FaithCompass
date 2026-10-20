/**
 * Optional Ed25519 signatures for Decision Passports.
 *
 * When the server environment holds PASSPORT_SIGNING_KEY (an Ed25519 private
 * key, PKCS#8 PEM or base64 DER), a passport is signed once, when it is
 * issued: the signature, key id (kid) and issue time travel inside the
 * passport ID and are verified as issued, never re-signed. Public keys are
 * published at /.well-known/abrahammoses-passport-keys.json, including retired
 * keys (with their validity window) so passports issued before a rotation keep
 * verifying. Without a key, passports say "unsigned: integrity hash only". No
 * key is ever generated or stored by this code, and the private key is never
 * logged or returned.
 *
 * A signature shows who issued a record (the holder of the published key) and
 * that it is unchanged. It does not show that the record is correct, and it is
 * not a third-party attestation.
 */
import { HISTORICAL_KEYS, type PublishedKey } from './keys';
import { createHash, createPrivateKey, createPublicKey, sign, verify, type KeyObject } from 'node:crypto';

export const UNSIGNED = 'unsigned: integrity hash only';
export const KEYS_PATH = '/.well-known/abrahammoses-passport-keys.json';
export const SIGNATURE_MEANING =
  'The SHA-256 hash shows the passport is unchanged since it was generated; a signature, when present, also shows who issued it (the holder of the published key). They do not show that the content is correct, and they are not a third-party attestation.';

/** Legacy message (formats 1-2 signed at render time; never used for new signatures). */
export function signedMessage(sha256Hex: string): string {
  return `AbrahamMoses Decision Passport v1\n${sha256Hex.toLowerCase()}`;
}

/** The exact bytes signed at issuance: a fixed prefix (domain separation), the hash, the key id and the issue time. */
export function issuanceMessage(sha256Hex: string, kid: string, issuedAt: string): string {
  return `AbrahamMoses Decision Passport issuance v2\n${sha256Hex.toLowerCase()}\n${kid}\n${issuedAt}`;
}

export interface PassportSigner {
  keyId: string;
  /** Raw 32-byte public key, base64url (JWK "x"). */
  x: string;
  publicKeyPem: string;
  /** Signs the issuance message for this hash and issue time. */
  signIssuance(sha256Hex: string, issuedAt: string): string;
  /** Start of this key's validity window, from PASSPORT_SIGNING_KEY_NOT_BEFORE (ISO time), if set. */
  notBefore: string | null;
}

export type SignerState = { status: 'signing'; signer: PassportSigner } | { status: 'unsigned' } | { status: 'misconfigured' };

function loadPrivateKey(raw: string): KeyObject {
  const text = raw.trim();
  if (text.includes('-----BEGIN')) return createPrivateKey(text.replace(/\\n/g, '\n'));
  return createPrivateKey({ key: Buffer.from(text, 'base64'), format: 'der', type: 'pkcs8' });
}

export function signerFrom(raw: string | undefined, notBefore: string | null = null): SignerState {
  if (!raw) return { status: 'unsigned' };
  let key: KeyObject;
  try {
    key = loadPrivateKey(raw);
  } catch {
    return { status: 'misconfigured' };
  }
  if (key.asymmetricKeyType !== 'ed25519') return { status: 'misconfigured' };
  const pub = createPublicKey(key);
  const x = pub.export({ format: 'jwk' }).x as string;
  const keyId = `ed25519-${createHash('sha256').update(Buffer.from(x, 'base64url')).digest('hex').slice(0, 16)}`;
  return {
    status: 'signing',
    signer: {
      keyId,
      x,
      publicKeyPem: pub.export({ format: 'pem', type: 'spki' }).toString(),
      notBefore,
      signIssuance: (sha256Hex, issuedAt) => sign(null, Buffer.from(issuanceMessage(sha256Hex, keyId, issuedAt), 'utf8'), key).toString('base64url'),
    },
  };
}

let cache: { raw: string | undefined; nb: string | undefined; state: SignerState } | null = null;

/** The signer configured in this server's environment, memoised per key value. */
export function configuredSigner(env: Record<string, string | undefined> = process.env): SignerState {
  const raw = env.PASSPORT_SIGNING_KEY;
  const nb = env.PASSPORT_SIGNING_KEY_NOT_BEFORE;
  if (!cache || cache.raw !== raw || cache.nb !== nb) cache = { raw, nb, state: signerFrom(raw, nb && !Number.isNaN(Date.parse(nb)) ? nb : null) };
  return cache.state;
}

function verifyEd25519(message: string, signature: string, x: string): boolean {
  try {
    const pub = createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x }, format: 'jwk' });
    return verify(null, Buffer.from(message, 'utf8'), pub, Buffer.from(signature, 'base64url'));
  } catch {
    return false;
  }
}

/** Legacy render-time signature check (formats 1-2). */
export function verifySignature(sha256Hex: string, signature: string, x: string): boolean {
  return verifyEd25519(signedMessage(sha256Hex), signature, x);
}

/** Every key a passport may name: the active key (if any) and every retired key, retired keys never dropped. */
export function keyRegistry(state: SignerState = configuredSigner(), historical: readonly PublishedKey[] = HISTORICAL_KEYS): PublishedKey[] {
  const keys: PublishedKey[] = historical.map((k) => ({ ...k }));
  if (state.status === 'signing' && !keys.some((k) => k.kid === state.signer.keyId)) {
    keys.unshift({ kid: state.signer.keyId, x: state.signer.x, status: 'active', not_before: state.signer.notBefore, not_after: null });
  }
  return keys;
}

export interface IssuedSignature {
  alg: 'Ed25519';
  kid: string;
  issued_at: string;
  value: string;
}

export type SignatureCheck = { valid: true } | { valid: false; reason: string };

/** Verify an issuance signature exactly as issued: known kid, issue time inside the key's window, valid Ed25519. */
export function verifyIssued(sha256Hex: string, sig: IssuedSignature, keys: readonly PublishedKey[]): SignatureCheck {
  const key = keys.find((k) => k.kid === sig.kid);
  if (!key) return { valid: false, reason: `Unknown key id ${sig.kid}.` };
  const at = Date.parse(sig.issued_at);
  if (Number.isNaN(at)) return { valid: false, reason: 'Invalid issue time.' };
  if (key.not_before && at < Date.parse(key.not_before)) return { valid: false, reason: `Issued before key ${sig.kid} was valid.` };
  if (key.not_after && at > Date.parse(key.not_after)) return { valid: false, reason: `Issued after key ${sig.kid} was retired.` };
  if (!verifyEd25519(issuanceMessage(sha256Hex, sig.kid, sig.issued_at), sig.value, key.x)) return { valid: false, reason: 'The signature does not match.' };
  return { valid: true };
}

/** The public key document served at KEYS_PATH. Lists the active key and every retired key. */
export function publicKeysDocument(state: SignerState = configuredSigner(), historical: readonly PublishedKey[] = HISTORICAL_KEYS) {
  const keys = keyRegistry(state, historical);
  return {
    object: 'passport_keys',
    status: state.status === 'signing' ? 'signing' : UNSIGNED,
    keys: keys.map((k) => ({
      kid: k.kid,
      kty: 'OKP',
      crv: 'Ed25519',
      alg: 'EdDSA',
      use: 'sig',
      x: k.x,
      status: k.status,
      not_before: k.not_before,
      not_after: k.not_after,
      public_key_pem: createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: k.x }, format: 'jwk' }).export({ format: 'pem', type: 'spki' }).toString(),
    })),
    signed_message:
      'UTF-8 bytes of "AbrahamMoses Decision Passport issuance v2\\n" + lowercase hex SHA-256 integrity hash + "\\n" + kid + "\\n" + issued_at. The signature is made once at issuance and carried in the passport ID.',
    rotation: 'Retired keys stay listed with their validity window, so passports issued before a rotation keep verifying.',
    meaning: SIGNATURE_MEANING,
  };
}
