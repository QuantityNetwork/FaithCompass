import { JsonEvidenceStore } from './json-store';
import { MemoryEvidenceStore } from './memory-store';
import { SupabaseEvidenceStore } from './supabase-store';
import type { EvidenceStore } from './types';

export type { EvidenceStore } from './types';
export { SupabaseConfigError } from './supabase-store';

let instance: EvidenceStore | null = null;

function isDeployedRuntime(): boolean {
  return process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
}

/**
 * Pick a store.
 *
 * Supabase when it is configured (or EVIDENCE_STORE=supabase, which raises if
 * it is not). EVIDENCE_STORE=json and =memory force the file and memory stores.
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

  if (configured === 'json') {
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
