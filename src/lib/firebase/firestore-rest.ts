/**
 * Minimal Cloud Firestore REST client (server only).
 *
 * No SDK: the store needs get, query and atomic commits with preconditions, which the v1 REST API provides with
 * plain fetch. Credentials come only from the server environment:
 *
 *   FIREBASE_PROJECT_ID     project id (not secret), e.g. abrahammoses-a0a26
 *   FIREBASE_CLIENT_EMAIL   service account email
 *   FIREBASE_PRIVATE_KEY    service account private key (PEM; "\n" escapes are accepted)
 *
 * With FIRESTORE_EMULATOR_HOST set, requests go to the local emulator and no credentials are used. The private key
 * and access tokens are never logged or returned.
 */
import { createSign } from 'node:crypto';

export class FirestoreConfigError extends Error {
  constructor(missing: string[]) {
    super(`Firestore store selected but not configured. Missing: ${missing.join(', ')}.`);
    this.name = 'FirestoreConfigError';
  }
}

export class FirestoreRequestError extends Error {
  constructor(
    readonly httpStatus: number,
    readonly grpcStatus: string,
    message: string,
  ) {
    super(message);
    this.name = 'FirestoreRequestError';
  }
}

export interface FirestoreConfig {
  projectId: string;
  emulatorHost: string | null;
  clientEmail: string | null;
  privateKey: string | null;
}

/** Vercel stores multi-line values either verbatim or with literal "\n"; accept both, and stray quotes. */
export function normalisePrivateKey(raw: string): string {
  return raw.trim().replace(/^"|"$/g, '').replace(/\\n/g, '\n').replace(/\r/g, '').trim();
}

export function firestoreConfigFromEnv(env: Record<string, string | undefined> = process.env): FirestoreConfig {
  const projectId = env.FIREBASE_PROJECT_ID || null;
  const emulatorHost = env.FIRESTORE_EMULATOR_HOST || null;
  const missing: string[] = [];
  if (!projectId) missing.push('FIREBASE_PROJECT_ID');
  if (!emulatorHost) {
    if (!env.FIREBASE_CLIENT_EMAIL) missing.push('FIREBASE_CLIENT_EMAIL');
    if (!env.FIREBASE_PRIVATE_KEY) missing.push('FIREBASE_PRIVATE_KEY');
  }
  if (missing.length) throw new FirestoreConfigError(missing);
  return {
    projectId: projectId!,
    emulatorHost,
    clientEmail: emulatorHost ? null : env.FIREBASE_CLIENT_EMAIL!,
    privateKey: emulatorHost ? null : normalisePrivateKey(env.FIREBASE_PRIVATE_KEY!),
  };
}

/** True when the environment selects Firestore: a project id plus either the emulator or service credentials. */
export function firestoreConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.FIREBASE_PROJECT_ID && (env.FIRESTORE_EMULATOR_HOST || (env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY)));
}

/* ---------- value encoding ---------- */

export type FsValue =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { stringValue: string }
  | { arrayValue: { values?: FsValue[] } }
  | { mapValue: { fields?: Record<string, FsValue> } };

export function encodeValue(v: unknown): FsValue {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encodeValue) } };
  if (typeof v === 'object') return { mapValue: { fields: encodeFields(v as Record<string, unknown>) } };
  throw new TypeError(`Cannot encode ${typeof v} for Firestore`);
}

export function encodeFields(o: Record<string, unknown>): Record<string, FsValue> {
  const out: Record<string, FsValue> = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined) out[k] = encodeValue(v);
  return out;
}

export function decodeValue(v: FsValue): unknown {
  if ('nullValue' in v) return null;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('stringValue' in v) return v.stringValue;
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(decodeValue);
  if ('mapValue' in v) return decodeFields(v.mapValue.fields ?? {});
  return null;
}

export function decodeFields(f: Record<string, FsValue>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(f).map(([k, v]) => [k, decodeValue(v)]));
}

/* ---------- client ---------- */

export interface FsDocument {
  name: string;
  fields: Record<string, unknown>;
  updateTime: string;
}

export type Precondition = { exists: boolean } | { updateTime: string };

export interface FsWrite {
  collection: string;
  id: string;
  fields: Record<string, unknown>;
  precondition?: Precondition;
}

export type FsFilter = { field: string; op: 'EQUAL' | 'ARRAY_CONTAINS'; value: unknown };

export type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

const SCOPE = 'https://www.googleapis.com/auth/datastore';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

export class FirestoreRest {
  private token: { value: string; exp: number } | null = null;

  constructor(
    readonly config: FirestoreConfig,
    private readonly fetchImpl: Fetch = (i, init) => fetch(i, init),
  ) {}

  get documentsPath(): string {
    return `projects/${this.config.projectId}/databases/(default)/documents`;
  }

  private get base(): string {
    return this.config.emulatorHost ? `http://${this.config.emulatorHost}/v1` : 'https://firestore.googleapis.com/v1';
  }

  /** OAuth2 access token from a service-account JWT (RFC 7523), cached until shortly before expiry. */
  private async authorization(): Promise<string> {
    if (this.config.emulatorHost) return 'Bearer owner';
    const now = Math.floor(Date.now() / 1000);
    if (this.token && this.token.exp - 60 > now) return `Bearer ${this.token.value}`;
    const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: this.config.clientEmail, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 })}`;
    const signature = createSign('RSA-SHA256').update(unsigned).sign(this.config.privateKey!).toString('base64url');
    const res = await this.fetchImpl(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }).toString(),
    });
    if (!res.ok) throw new FirestoreRequestError(res.status, 'UNAUTHENTICATED', `Service account token request failed (HTTP ${res.status}).`);
    const body = (await res.json()) as { access_token: string; expires_in: number };
    this.token = { value: body.access_token, exp: now + body.expires_in };
    return `Bearer ${body.access_token}`;
  }

  private async call(method: string, path: string, body?: unknown): Promise<Response> {
    const res = await this.fetchImpl(`${this.base}/${path}`, {
      method,
      headers: { authorization: await this.authorization(), 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return res;
  }

  private static async fail(res: Response, what: string): Promise<never> {
    let status = 'UNKNOWN';
    try {
      status = ((await res.json()) as { error?: { status?: string } }).error?.status ?? status;
    } catch {
      /* body is not JSON */
    }
    // Only the status code and gRPC status are surfaced: never request bodies, document content or credentials.
    throw new FirestoreRequestError(res.status, status, `Firestore ${what} failed (HTTP ${res.status} ${status}).`);
  }

  async get(collection: string, id: string): Promise<FsDocument | null> {
    const res = await this.call('GET', `${this.documentsPath}/${collection}/${encodeURIComponent(id)}`);
    if (res.status === 404) return null;
    if (!res.ok) return FirestoreRest.fail(res, `get ${collection}`);
    const d = (await res.json()) as { name: string; fields?: Record<string, FsValue>; updateTime: string };
    return { name: d.name, fields: decodeFields(d.fields ?? {}), updateTime: d.updateTime };
  }

  /**
   * Apply writes atomically. Returns false when a precondition failed (the document changed or already exists), so
   * callers can implement compare-and-set; any other failure throws.
   */
  async commit(writes: FsWrite[]): Promise<boolean> {
    const res = await this.call('POST', `${this.documentsPath}:commit`, {
      writes: writes.map((w) => ({
        update: { name: `${this.documentsPath}/${w.collection}/${w.id}`, fields: encodeFields(w.fields) },
        ...(w.precondition ? { currentDocument: w.precondition } : {}),
      })),
    });
    if (res.ok) return true;
    const clone = res.clone();
    let status = '';
    try {
      status = ((await clone.json()) as { error?: { status?: string } }).error?.status ?? '';
    } catch {
      /* ignore */
    }
    if (status === 'FAILED_PRECONDITION' || status === 'ALREADY_EXISTS' || status === 'NOT_FOUND' || status === 'ABORTED') return false;
    return FirestoreRest.fail(res, 'commit');
  }

  /** Equality / array-contains query on one collection. Ordering is done by the caller (no composite indexes). */
  async query(collection: string, filters: FsFilter[], limit?: number): Promise<FsDocument[]> {
    const where =
      filters.length === 0
        ? undefined
        : filters.length === 1
          ? { fieldFilter: { field: { fieldPath: filters[0].field }, op: filters[0].op, value: encodeValue(filters[0].value) } }
          : { compositeFilter: { op: 'AND', filters: filters.map((f) => ({ fieldFilter: { field: { fieldPath: f.field }, op: f.op, value: encodeValue(f.value) } })) } };
    const res = await this.call('POST', `${this.documentsPath}:runQuery`, {
      structuredQuery: { from: [{ collectionId: collection }], ...(where ? { where } : {}), ...(limit ? { limit } : {}) },
    });
    if (!res.ok) return FirestoreRest.fail(res, `query ${collection}`);
    const rows = (await res.json()) as { document?: { name: string; fields?: Record<string, FsValue>; updateTime: string } }[];
    return rows.filter((r) => r.document).map((r) => ({ name: r.document!.name, fields: decodeFields(r.document!.fields ?? {}), updateTime: r.document!.updateTime }));
  }
}
