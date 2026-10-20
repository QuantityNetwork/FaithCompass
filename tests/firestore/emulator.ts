/** Helpers for tests that run against the Firestore emulator (`npm run test:firestore`). */
import { FirestoreRest } from '@/lib/firebase/firestore-rest';

export const PROJECT = process.env.FIREBASE_PROJECT_ID || 'abrahammoses-a0a26';
export const HOST = process.env.FIRESTORE_EMULATOR_HOST || '';
export const ON_EMULATOR = Boolean(HOST);
export const DOCS = `http://${HOST}/v1/projects/${PROJECT}/databases/(default)/documents`;

/** Unauthenticated client (public reads). */
export function publicDb(): FirestoreRest {
  return new FirestoreRest({ projectId: PROJECT, emulatorHost: HOST });
}

/** Emulator-only rules bypass, for seeding and inspecting test data. Never possible against a real project. */
export function adminDb(): FirestoreRest {
  return new FirestoreRest({ projectId: PROJECT, emulatorHost: HOST }, 'owner');
}

export async function clearEmulator(): Promise<void> {
  const res = await fetch(`http://${HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`clear failed: ${res.status}`);
}

/** An unsigned Firebase ID token, as the emulator accepts (it never reaches a real project). */
export function mockToken(uid: string, claims: Record<string, unknown> = {}, provider = 'password'): string {
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'none', kid: 'fakekid', typ: 'JWT' })}.${b64({
    iss: `https://securetoken.google.com/${PROJECT}`,
    aud: PROJECT,
    iat: now,
    exp: now + 3600,
    auth_time: now,
    sub: uid,
    user_id: uid,
    firebase: { sign_in_provider: provider, identities: {} },
    ...claims,
  })}.`;
}

type Token = string | null;

function enc(v: unknown): unknown {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return { integerValue: String(v) };
  throw new Error('unsupported');
}

function fields(o: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, enc(v)]));
}

/** A client request with a user's token (or none): returns the HTTP status, so tests assert allow/deny. */
export const client = {
  async get(token: Token, path: string): Promise<number> {
    return (await fetch(`${DOCS}/${path}`, { headers: token ? { authorization: `Bearer ${token}` } : {} })).status;
  },
  async commit(token: Token, writes: { path: string; data: Record<string, unknown>; exists?: boolean; del?: boolean }[]): Promise<number> {
    const res = await fetch(`${DOCS}:commit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({
        writes: writes.map((w) =>
          w.del
            ? { delete: `projects/${PROJECT}/databases/(default)/documents/${w.path}` }
            : {
                update: { name: `projects/${PROJECT}/databases/(default)/documents/${w.path}`, fields: fields(w.data) },
                ...(w.exists === undefined ? {} : { currentDocument: { exists: w.exists } }),
              },
        ),
      }),
    });
    return res.status;
  },
};

/** Seed documents as the server (rules bypassed). */
export async function seed(path: string, data: Record<string, unknown>): Promise<void> {
  const [collection, ...rest] = path.split('/');
  const db = adminDb();
  if (rest.length === 1) {
    await db.commit([{ collection, id: rest[0], fields: data }]);
  } else {
    const id = rest.pop()!;
    await db.commit([{ collection: [collection, ...rest].join('/'), id, fields: data }]);
  }
}
