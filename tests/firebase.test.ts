/**
 * Firebase adapter units that need no emulator: env handling (exact variable names, private-key escapes, no
 * secret in errors), store selection gating, the service-account token flow and ID-token verification.
 * Keys are generated in memory for the test only.
 */
import { generateKeyPairSync, createSign } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveActor, setTokenVerifier } from '@/lib/auth/actor';
import { FirestoreConfigError, FirestoreRest, firestoreConfigFromEnv, firestoreConfigured, normalisePrivateKey } from '@/lib/firebase/firestore-rest';
import { verifyFirebaseIdToken } from '@/lib/firebase/id-token';
import { getStore, setStore } from '@/lib/evidence/store';
import { FirestoreEvidenceStore } from '@/lib/evidence/store/firestore-store';
import { MemoryEvidenceStore } from '@/lib/evidence/store/memory-store';

const KEYS = ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY', 'FIRESTORE_EMULATOR_HOST', 'EVIDENCE_STORE', 'VERCEL', 'AUTH_PROVIDER', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const;
let saved: Record<string, string | undefined>;
beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  for (const k of KEYS) delete process.env[k];
  setStore(null);
});
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k]!;
  }
  setStore(null);
  setTokenVerifier(null);
});

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();

describe('Firebase configuration', () => {
  it('uses exactly FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY, and accepts \\n escapes', () => {
    const escaped = PEM.replace(/\n/g, '\\n');
    const c = firestoreConfigFromEnv({ FIREBASE_PROJECT_ID: 'abrahammoses-a0a26', FIREBASE_CLIENT_EMAIL: 'sa@abrahammoses-a0a26.iam.gserviceaccount.com', FIREBASE_PRIVATE_KEY: `"${escaped}"` });
    expect(c.projectId).toBe('abrahammoses-a0a26');
    expect(c.privateKey).toBe(PEM.trim());
    expect(normalisePrivateKey(PEM)).toBe(PEM.trim());
  });

  it('names missing variables without echoing any value', () => {
    try {
      firestoreConfigFromEnv({ FIREBASE_PROJECT_ID: 'abrahammoses-a0a26', FIREBASE_PRIVATE_KEY: PEM });
      throw new Error('expected a config error');
    } catch (e) {
      expect(e).toBeInstanceOf(FirestoreConfigError);
      expect((e as Error).message).toBe('Firestore store selected but not configured. Missing: FIREBASE_CLIENT_EMAIL.');
      expect((e as Error).message).not.toContain('PRIVATE KEY-----');
    }
  });

  it('the emulator needs only the project id', () => {
    expect(firestoreConfigFromEnv({ FIREBASE_PROJECT_ID: 'abrahammoses-a0a26', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8085' }).emulatorHost).toBe('127.0.0.1:8085');
    expect(firestoreConfigured({ FIREBASE_PROJECT_ID: 'p' })).toBe(false);
  });
});

describe('store selection with Firebase', () => {
  const creds = () => {
    process.env.FIREBASE_PROJECT_ID = 'abrahammoses-a0a26';
    process.env.FIREBASE_CLIENT_EMAIL = 'sa@abrahammoses-a0a26.iam.gserviceaccount.com';
    process.env.FIREBASE_PRIVATE_KEY = PEM;
  };

  it('on a deployed runtime, credentials alone keep the site read-only until EVIDENCE_STORE=firestore', () => {
    creds();
    process.env.VERCEL = '1';
    expect(getStore()).toBeInstanceOf(MemoryEvidenceStore);
    setStore(null);
    process.env.EVIDENCE_STORE = 'firestore';
    expect(getStore()).toBeInstanceOf(FirestoreEvidenceStore);
  });

  it('selects Firestore in development when configured, and raises when forced without credentials', () => {
    creds();
    expect(getStore()).toBeInstanceOf(FirestoreEvidenceStore);
    setStore(null);
    for (const k of ['FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'] as const) delete process.env[k];
    process.env.EVIDENCE_STORE = 'firestore';
    expect(() => getStore()).toThrow(FirestoreConfigError);
  });
});

describe('service-account access token', () => {
  it('signs an RS256 assertion for the datastore scope, caches the token and never sends the key', async () => {
    const calls: { url: string; body: string }[] = [];
    const fake = async (url: string, init?: RequestInit) => {
      calls.push({ url, body: String(init?.body ?? '') });
      if (url.startsWith('https://oauth2.googleapis.com/token')) return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }), { status: 200 });
      expect((init?.headers as Record<string, string>).authorization).toBe('Bearer tok');
      return new Response('', { status: 404 });
    };
    const db = new FirestoreRest({ projectId: 'abrahammoses-a0a26', emulatorHost: null, clientEmail: 'sa@x.iam.gserviceaccount.com', privateKey: PEM }, fake);
    expect(await db.get('evidence_analyses', 'a')).toBeNull();
    expect(await db.get('evidence_analyses', 'b')).toBeNull();
    const tokenCalls = calls.filter((c) => c.url.startsWith('https://oauth2.googleapis.com/token'));
    expect(tokenCalls).toHaveLength(1);
    const assertion = new URLSearchParams(tokenCalls[0].body).get('assertion')!;
    const [h, p] = assertion.split('.').slice(0, 2).map((x) => JSON.parse(Buffer.from(x, 'base64url').toString()));
    expect(h.alg).toBe('RS256');
    expect(p).toMatchObject({ iss: 'sa@x.iam.gserviceaccount.com', scope: 'https://www.googleapis.com/auth/datastore', aud: 'https://oauth2.googleapis.com/token' });
    expect(calls.map((c) => c.body).join()).not.toContain('PRIVATE KEY');
    expect(calls[1].url).toBe('https://firestore.googleapis.com/v1/projects/abrahammoses-a0a26/databases/(default)/documents/evidence_analyses/a');
  });
});

describe('Firebase ID tokens', () => {
  const kid = 'k1';
  const jwk = { ...(publicKey.export({ format: 'jwk' }) as object), kid } as never;
  const keys = { keys: [jwk] };
  const now = Date.parse('2026-10-20T19:00:00Z');
  const t = Math.floor(now / 1000);
  function sign(payload: Record<string, unknown>, header: Record<string, unknown> = { alg: 'RS256', kid }) {
    const b = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const unsigned = `${b(header)}.${b(payload)}`;
    return `${unsigned}.${createSign('RSA-SHA256').update(unsigned).sign(privateKey).toString('base64url')}`;
  }
  const good = { aud: 'abrahammoses-a0a26', iss: 'https://securetoken.google.com/abrahammoses-a0a26', sub: 'u1', iat: t - 10, auth_time: t - 10, exp: t + 3000, am_role: 'research_editor', firebase: { sign_in_provider: 'password' } };

  it('accepts a valid token and reads the role claim', async () => {
    expect(await verifyFirebaseIdToken(sign(good), 'abrahammoses-a0a26', { keys, now })).toMatchObject({ id: 'u1', appRole: 'research_editor' });
  });

  it('rejects wrong audience, issuer, expiry, anonymous sign-in, unknown kid, alg none and tampering', async () => {
    const v = (tok: string) => verifyFirebaseIdToken(tok, 'abrahammoses-a0a26', { keys, now });
    expect(await v(sign({ ...good, aud: 'other' }))).toBeNull();
    expect(await v(sign({ ...good, iss: 'https://securetoken.google.com/other' }))).toBeNull();
    expect(await v(sign({ ...good, exp: t - 1 }))).toBeNull();
    expect(await v(sign({ ...good, firebase: { sign_in_provider: 'anonymous' } }))).toBeNull();
    expect(await v(sign(good, { alg: 'RS256', kid: 'nope' }))).toBeNull();
    const none = `${Buffer.from(JSON.stringify({ alg: 'none', kid })).toString('base64url')}.${Buffer.from(JSON.stringify(good)).toString('base64url')}.`;
    expect(await v(none)).toBeNull();
    const [h, , s] = sign(good).split('.');
    expect(await v(`${h}.${Buffer.from(JSON.stringify({ ...good, am_role: 'editorial_admin' })).toString('base64url')}.${s}`)).toBeNull();
  });

  it('resolveActor uses Firebase only when AUTH_PROVIDER=firebase, and never trusts a client-set role', async () => {
    const req = new Request('http://x/', { headers: { authorization: `Bearer ${'a'.repeat(40)}`, 'x-role': 'editorial_admin' } });
    expect((await resolveActor(req)).authenticated).toBe(false);
    process.env.AUTH_PROVIDER = 'firebase';
    process.env.FIREBASE_PROJECT_ID = 'abrahammoses-a0a26';
    setTokenVerifier(async () => ({ id: 'u1', appRole: undefined }));
    expect(await resolveActor(req)).toEqual({ id: 'u1', role: 'research_contributor', authenticated: true, via: 'firebase' });
    setTokenVerifier(async () => ({ id: 'u1', appRole: 'research_editor' }));
    expect((await resolveActor(req)).role).toBe('research_editor');
  });
});
