/**
 * Firebase adapter units that need no emulator: env handling (exact variable names, private-key escapes, no
 * secret in errors), store selection gating, the service-account token flow and ID-token verification.
 * Keys are generated in memory for the test only.
 */
import { generateKeyPairSync, createSign } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { idTokenOf, resolveActor, setTokenVerifier } from '@/lib/auth/actor';
import { FirestoreConfigError, FirestoreRest, firestoreConfigFromEnv, firestoreConfigured } from '@/lib/firebase/firestore-rest';
import { firebaseWebConfig } from '@/lib/firebase/web-config';
import { verifyFirebaseIdToken } from '@/lib/firebase/id-token';
import { getStore, setStore } from '@/lib/evidence/store';
import { FirestoreEvidenceStore } from '@/lib/evidence/store/firestore-store';
import { MemoryEvidenceStore } from '@/lib/evidence/store/memory-store';

const KEYS = ['FIREBASE_PROJECT_ID', 'NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'NEXT_PUBLIC_FIREBASE_API_KEY', 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', 'NEXT_PUBLIC_FIREBASE_APP_ID', 'FIRESTORE_EMULATOR_HOST', 'EVIDENCE_STORE', 'VERCEL', 'AUTH_PROVIDER', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const;
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

describe('Firebase configuration (no admin key)', () => {
  it('needs only the project id, from FIREBASE_PROJECT_ID or NEXT_PUBLIC_FIREBASE_PROJECT_ID', () => {
    expect(firestoreConfigFromEnv({ FIREBASE_PROJECT_ID: 'abrahammoses-a0a26' })).toEqual({ projectId: 'abrahammoses-a0a26', emulatorHost: null });
    expect(firestoreConfigFromEnv({ NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'abrahammoses-a0a26' }).projectId).toBe('abrahammoses-a0a26');
    expect(firestoreConfigFromEnv({ FIREBASE_PROJECT_ID: 'p1', FIRESTORE_DATABASE_ID: 'preview' }).databaseId).toBe('preview');
    expect(new FirestoreRest(firestoreConfigFromEnv({ FIREBASE_PROJECT_ID: 'p1', FIRESTORE_DATABASE_ID: 'preview' })).documentsPath).toBe('projects/p1/databases/preview/documents');
    expect(new FirestoreRest(firestoreConfigFromEnv({ FIREBASE_PROJECT_ID: 'p1' })).documentsPath).toBe('projects/p1/databases/(default)/documents');
    expect(() => firestoreConfigFromEnv({ FIREBASE_PROJECT_ID: 'p1', FIRESTORE_DATABASE_ID: '../x' })).toThrow(FirestoreConfigError);
    expect(() => firestoreConfigFromEnv({})).toThrow(FirestoreConfigError);
    expect(firestoreConfigured({})).toBe(false);
  });

  it('reads the public web config from NEXT_PUBLIC_FIREBASE_* and reports what is missing', () => {
    expect(firebaseWebConfig({})).toEqual({ ok: false, missing: ['NEXT_PUBLIC_FIREBASE_API_KEY', 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', 'NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'NEXT_PUBLIC_FIREBASE_APP_ID'] });
    const ok = firebaseWebConfig({ NEXT_PUBLIC_FIREBASE_API_KEY: 'k', NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'abrahammoses-a0a26.firebaseapp.com', NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'abrahammoses-a0a26', NEXT_PUBLIC_FIREBASE_APP_ID: '1:2:web:3' });
    expect(ok).toMatchObject({ ok: true, config: { projectId: 'abrahammoses-a0a26', authDomain: 'abrahammoses-a0a26.firebaseapp.com' } });
  });

  it('sends the user’s own ID token, never an admin credential, and refuses the emulator owner token in production', async () => {
    const seen: (string | undefined)[] = [];
    const fake = async (_url: string, init?: RequestInit) => {
      seen.push((init?.headers as Record<string, string>).authorization);
      return new Response('', { status: 404 });
    };
    const db = new FirestoreRest({ projectId: 'abrahammoses-a0a26', emulatorHost: null }, null, fake);
    await db.get('evidence_analyses', 'a');
    await db.as('user-id-token').get('evidence_analyses', 'a');
    expect(seen).toEqual([undefined, 'Bearer user-id-token']);
    expect(() => new FirestoreRest({ projectId: 'abrahammoses-a0a26', emulatorHost: null }, 'owner')).toThrow(/emulator only/);
  });
});

describe('store selection with Firebase', () => {
  it('on a deployed runtime, a project id alone keeps the site read-only until EVIDENCE_STORE=firestore', () => {
    process.env.FIREBASE_PROJECT_ID = 'abrahammoses-a0a26';
    process.env.VERCEL = '1';
    expect(getStore()).toBeInstanceOf(MemoryEvidenceStore);
    setStore(null);
    process.env.EVIDENCE_STORE = 'firestore';
    expect(getStore()).toBeInstanceOf(FirestoreEvidenceStore);
  });

  it('raises when Firestore is forced without a project id', () => {
    process.env.EVIDENCE_STORE = 'firestore';
    expect(() => getStore()).toThrow(FirestoreConfigError);
  });

  it('the Firestore store refuses attributed writes without a user and keeps curated seeds in the overlay', async () => {
    const store = new FirestoreEvidenceStore(new FirestoreRest({ projectId: 'p', emulatorHost: null }, null, async () => new Response('', { status: 404 })));
    expect(store.requiresIdentity).toBe(true);
    await expect(store.saveDraft({ id: 'd', status: 'draft', createdBy: null, creatorRole: 'public_reader', analysis: {} as never, createdAt: 'x' })).rejects.toThrow();
    await expect(
      store.appendAudit({ id: 'a', entityType: 'PROPOSAL', entityId: 'p', changeType: 'PROPOSED', oldValue: null, newValue: null, reason: 'r', modelProvider: null, modelVersion: null, promptVersion: null, timestamp: 't', actorId: 'u1' }),
    ).rejects.toThrow(/signed-in user/);
  });
});

describe('anonymous drafts on Firestore', () => {
  it('answer 401 before any analysis runs, and write nothing', async () => {
    const calls: string[] = [];
    setStore(new FirestoreEvidenceStore(new FirestoreRest({ projectId: 'p', emulatorHost: null }, null, async (url: string) => (calls.push(url), new Response('', { status: 404 })))));
    const { POST } = await import('@/app/api/evidence/analyze/route');
    const res = await POST(new Request('http://localhost/api/evidence/analyze', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost' }, body: JSON.stringify({ query: 'Daniel 12:1' }) }));
    expect(res.status).toBe(401);
    expect(calls.filter((u) => u.includes(':commit'))).toEqual([]);
  });
});

describe('curated demonstrations on Firestore', () => {
  it('carry the same version stamp in every server instance, so proposals stay valid across instances', async () => {
    const { runAnalysis } = await import('@/lib/evidence/pipeline');
    const { CorpusReasoningProvider } = await import('@/lib/evidence/providers/corpus');
    const { DANIEL_12_1 } = await import('@/lib/evidence/seed/daniel-12-1');
    const { CURATED_VERSION_STAMP } = await import('@/lib/evidence/store/firestore-store');
    const instance = async () => {
      const store = new FirestoreEvidenceStore(new FirestoreRest({ projectId: 'p', emulatorHost: null }, null, async () => new Response('', { status: 404 })));
      setStore(store);
      const r = await runAnalysis({ query: DANIEL_12_1.aliases[0], reference: DANIEL_12_1.reference, passageText: DANIEL_12_1.passageText }, new CorpusReasoningProvider());
      return store.getAnalysis(r.analysis!.id);
    };
    const a = await instance();
    await new Promise((r) => setTimeout(r, 5));
    const b = await instance();
    expect(a?.updatedAt).toBe(CURATED_VERSION_STAMP);
    expect(b).toEqual(a);
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
    const actor = await resolveActor(req);
    expect(actor).toEqual({ id: 'u1', role: 'research_contributor', authenticated: true, via: 'firebase' });
    // The verified token rides along for Firestore, but is never serialised
    expect(idTokenOf(actor)).toBe('a'.repeat(40));
    expect(JSON.stringify(actor)).not.toContain('aaaa');
    setTokenVerifier(async () => ({ id: 'u1', appRole: 'research_editor' }));
    expect((await resolveActor(req)).role).toBe('research_editor');
  });
});
