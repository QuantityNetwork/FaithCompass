/**
 * Minimal Cloud Firestore REST client (server side), with no admin credentials.
 *
 * There is no service-account key (ADR 0001). Every request is made either unauthenticated (public reads) or with the
 * signed-in user's own Firebase Auth ID token, so Firestore evaluates firestore.rules for that user exactly as it
 * does for the client SDK. The server can therefore never do more than the user could do directly.
 *
 *   FIREBASE_PROJECT_ID (or NEXT_PUBLIC_FIREBASE_PROJECT_ID)   project id (not secret), e.g. abrahammoses-a0a26
 *   FIRESTORE_EMULATOR_HOST                                    local emulator (tests); never set in deployments
 *   FIRESTORE_DATABASE_ID                                      optional named database (default "(default)"), e.g. a
 *                                                              separate database for previews
 *
 * ID tokens are never logged or returned.
 */

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
  /** Database id; '(default)' when not set. */
  databaseId?: string;
}

const DATABASE_ID = /^[a-z][a-z0-9-]{3,62}$/;

export function firebaseProjectId(env: Record<string, string | undefined> = process.env): string | null {
  return env.FIREBASE_PROJECT_ID || env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || null;
}

export function firestoreConfigFromEnv(env: Record<string, string | undefined> = process.env): FirestoreConfig {
  const projectId = firebaseProjectId(env);
  if (!projectId) throw new FirestoreConfigError(['FIREBASE_PROJECT_ID (or NEXT_PUBLIC_FIREBASE_PROJECT_ID)']);
  const db = env.FIRESTORE_DATABASE_ID;
  if (db && db !== '(default)' && !DATABASE_ID.test(db)) throw new FirestoreConfigError(['a valid FIRESTORE_DATABASE_ID']);
  return { projectId, emulatorHost: env.FIRESTORE_EMULATOR_HOST || null, ...(db && db !== '(default)' ? { databaseId: db } : {}) };
}

/** True when a Firebase project id is configured. */
export function firestoreConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(firebaseProjectId(env));
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

export class FirestoreRest {
  /**
   * @param idToken the signed-in user's Firebase ID token, or null for an unauthenticated request. The literal
   *   'owner' bypasses rules and is accepted only by the emulator (test seeding); it is refused otherwise.
   */
  constructor(
    readonly config: FirestoreConfig,
    private readonly idToken: string | null = null,
    private readonly fetchImpl: Fetch = (i, init) => fetch(i, init),
  ) {
    if (idToken === 'owner' && !config.emulatorHost) throw new Error('The owner token is for the emulator only.');
  }

  /** The same client acting as another user (or unauthenticated). */
  as(idToken: string | null): FirestoreRest {
    return new FirestoreRest(this.config, idToken, this.fetchImpl);
  }

  get authenticated(): boolean {
    return this.idToken !== null;
  }

  get documentsPath(): string {
    return `projects/${this.config.projectId}/databases/${this.config.databaseId ?? '(default)'}/documents`;
  }

  private get base(): string {
    return this.config.emulatorHost ? `http://${this.config.emulatorHost}/v1` : 'https://firestore.googleapis.com/v1';
  }

  private async call(method: string, path: string, body?: unknown): Promise<Response> {
    const res = await this.fetchImpl(`${this.base}/${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...(this.idToken ? { authorization: `Bearer ${this.idToken}` } : {}) },
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
    if (res.status === 403) throw new FirestoreRequestError(403, 'PERMISSION_DENIED', 'Firestore refused the write under the security rules.');
    return FirestoreRest.fail(res, 'commit');
  }

  /** Every document of a (sub)collection, e.g. `tenants/t1/documents`, following page tokens (rules apply as for a query). */
  async list(collectionPath: string, pageSize = 300): Promise<FsDocument[]> {
    const out: FsDocument[] = [];
    let token = '';
    for (let page = 0; page < 50; page++) {
      const q = `pageSize=${pageSize}${token ? `&pageToken=${encodeURIComponent(token)}` : ''}`;
      const res = await this.call('GET', `${this.documentsPath}/${collectionPath}?${q}`);
      if (!res.ok) return FirestoreRest.fail(res, `list ${collectionPath.split('/').pop()}`);
      const body = (await res.json()) as { documents?: { name: string; fields?: Record<string, FsValue>; updateTime: string }[]; nextPageToken?: string };
      for (const d of body.documents ?? []) out.push({ name: d.name, fields: decodeFields(d.fields ?? {}), updateTime: d.updateTime });
      if (!body.nextPageToken) break;
      token = body.nextPageToken;
    }
    return out;
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
