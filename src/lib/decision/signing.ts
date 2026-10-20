/**
 * Optional Ed25519 signatures for Decision Passports.
 *
 * When the server environment holds PASSPORT_SIGNING_KEY (an Ed25519 private
 * key, PKCS#8 PEM or base64 DER), each passport's SHA-256 hash is signed and
 * the public key is published at /.well-known/abrahammoses-passport-keys.json.
 * Without it, passports say "unsigned: integrity hash only". No key is ever
 * generated or stored by this code, and the private key is never logged or
 * returned.
 *
 * A signature shows who issued a record (the holder of the published key) and
 * that it is unchanged. It does not show that the record is correct, and it is
 * not a third-party attestation.
 */
import { createHash, createPrivateKey, createPublicKey, sign, verify, type KeyObject } from 'node:crypto';

export const UNSIGNED = 'unsigned: integrity hash only';
export const KEYS_PATH = '/.well-known/abrahammoses-passport-keys.json';
export const SIGNATURE_MEANING =
  'The SHA-256 hash shows the passport is unchanged since it was generated; a signature, when present, also shows who issued it (the holder of the published key). They do not show that the content is correct, and they are not a third-party attestation.';

/** The exact bytes that are signed: a fixed prefix (domain separation) and the lowercase hex hash. */
export function signedMessage(sha256Hex: string): string {
  return `AbrahamMoses Decision Passport v1\n${sha256Hex.toLowerCase()}`;
}

export interface PassportSigner {
  keyId: string;
  /** Raw 32-byte public key, base64url (JWK "x"). */
  x: string;
  publicKeyPem: string;
  sign(sha256Hex: string): string;
}

export type SignerState = { status: 'signing'; signer: PassportSigner } | { status: 'unsigned' } | { status: 'misconfigured' };

function loadPrivateKey(raw: string): KeyObject {
  const text = raw.trim();
  if (text.includes('-----BEGIN')) return createPrivateKey(text.replace(/\\n/g, '\n'));
  return createPrivateKey({ key: Buffer.from(text, 'base64'), format: 'der', type: 'pkcs8' });
}

export function signerFrom(raw: string | undefined): SignerState {
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
      sign: (sha256Hex) => sign(null, Buffer.from(signedMessage(sha256Hex), 'utf8'), key).toString('base64url'),
    },
  };
}

let cache: { raw: string | undefined; state: SignerState } | null = null;

/** The signer configured in this server's environment, memoised per key value. */
export function configuredSigner(env: Record<string, string | undefined> = process.env): SignerState {
  const raw = env.PASSPORT_SIGNING_KEY;
  if (!cache || cache.raw !== raw) cache = { raw, state: signerFrom(raw) };
  return cache.state;
}

export function verifySignature(sha256Hex: string, signature: string, x: string): boolean {
  try {
    const pub = createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x }, format: 'jwk' });
    return verify(null, Buffer.from(signedMessage(sha256Hex), 'utf8'), pub, Buffer.from(signature, 'base64url'));
  } catch {
    return false;
  }
}

/** The public key document served at KEYS_PATH. Empty when passports are unsigned. */
export function publicKeysDocument(state: SignerState = configuredSigner()) {
  return {
    object: 'passport_keys',
    status: state.status === 'signing' ? 'signing' : UNSIGNED,
    keys:
      state.status === 'signing'
        ? [{ kid: state.signer.keyId, kty: 'OKP', crv: 'Ed25519', alg: 'EdDSA', use: 'sig', x: state.signer.x, public_key_pem: state.signer.publicKeyPem }]
        : [],
    signed_message: 'UTF-8 bytes of "AbrahamMoses Decision Passport v1\\n" followed by the lowercase hex SHA-256 integrity hash',
    meaning: SIGNATURE_MEANING,
  };
}
