import { firestoreConfigured } from '@/lib/firebase/firestore-rest';
import { FirestoreEvidenceStore } from './firestore-store';
import { JsonEvidenceStore } from './json-store';
import { MemoryEvidenceStore } from './memory-store';
import { SupabaseEvidenceStore } from './supabase-store';
import type { EvidenceStore } from './types';

export type { EvidenceStore } from './types';
export { SupabaseConfigError } from './supabase-store';
export { FirestoreConfigError } from '@/lib/firebase/firestore-rest';

let instance: EvidenceStore | null = null;

function isDeployedRuntime(): boolean {
  return process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
}

/**
 * Pick a store.
 *
 * Firestore (ADR 0001; no admin key, writes carry the user's ID token) when a
 * project id (FIREBASE_PROJECT_ID or NEXT_PUBLIC_FIREBASE_PROJECT_ID) is set in
 * local development and CI, and on a deployed runtime only with
 * EVIDENCE_STORE=firestore (which raises if they are not). Supabase is
 * superseded but still selected when only it is configured, or with
 * EVIDENCE_STORE=supabase. EVIDENCE_STORE=json and =memory force the file and
 * memory stores.
 *
 * With nothing configured: local development gets the file store; a deployed
 * runtime gets the read-only memory store. There is no silent fallback that
 * accepts writes it cannot keep: the file store reports `durable: false`
 * outside local development, the memory store always does, and every write
 * route checks `canPersist()` and answers 503 when it is false.
 */
export function getStore(): EvidenceStore {
  if (instance) return instance;

  const configured = (process.env.EVIDENCE_STORE || '').toLowerCase();
  const supabaseConfigured = Boolean(
    (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  // On a deployed runtime Firestore is used only when explicitly enabled (EVIDENCE_STORE=firestore), so setting the
  // credentials alone never opens public writes before the acceptance tests in ADR 0001 have passed.
  if (configured === 'firestore' || (configured === '' && firestoreConfigured() && !isDeployedRuntime())) {
    instance = new FirestoreEvidenceStore();
  } else if (configured === 'json') {
    instance = new JsonEvidenceStore();
  } else if (configured === 'memory') {
    instance = new MemoryEvidenceStore();
  } else if (configured === 'supabase' || supabaseConfigured) {
    instance = new SupabaseEvidenceStore();
  } else {
    instance = isDeployedRuntime() ? new MemoryEvidenceStore() : new JsonEvidenceStore();
  }
  return instance;
}

/** True only when the active store keeps writes beyond the current process. */
export function canPersist(): boolean {
  return getStore().durable === true;
}

export const NOT_PERSISTED_MESSAGE =
  'This deployment has no database, so it shows the curated demonstrations read-only. New analyses and challenges cannot be saved here.';

/** Test seam. */
export function setStore(store: EvidenceStore | null): void {
  instance = store;
}

/** The active store acting as this actor (Firestore writes carry the actor's own ID token). */
export function storeFor(actor: import('@/lib/auth/actor').Actor): EvidenceStore {
  const store = getStore();
  return store.forActor ? store.forActor(actor) : store;
}
