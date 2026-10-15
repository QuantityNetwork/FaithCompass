import { JsonEvidenceStore } from './json-store';
import { MemoryEvidenceStore } from './memory-store';
import { SupabaseEvidenceStore } from './supabase-store';
import type { EvidenceStore } from './types';

export type { EvidenceStore } from './types';
export { SupabaseConfigError } from './supabase-store';

let instance: EvidenceStore | null = null;

/**
 * Pick a store.
 *
 * Defaults to Supabase when it is configured, because the file store cannot
 * survive a serverless host: the bundle filesystem is read-only, /tmp is wiped
 * between cold starts, and seeding would throw on the first request. Falling
 * back silently to the file store in production would turn that into a
 * deployment that looks healthy until the first restart quietly loses every
 * challenge recorded since the last one.
 *
 * EVIDENCE_STORE forces the choice either way. EVIDENCE_STORE=memory is the
 * deliberate choice for a deployment without a database: the curated
 * demonstrations are served, and anything a visitor would create is refused.
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
    return instance;
  }

  if (configured === 'memory') {
    instance = new MemoryEvidenceStore();
    return instance;
  }

  // An explicit request for Supabase raises if it is not configured, rather
  // than quietly degrading to a store that cannot persist anything.
  if (configured === 'supabase' || supabaseConfigured) {
    instance = new SupabaseEvidenceStore();
    return instance;
  }

  instance = new JsonEvidenceStore();
  return instance;
}

/** False while the store keeps nothing past the current instance. */
export function canPersist(): boolean {
  return !(getStore() instanceof MemoryEvidenceStore);
}

export const NOT_PERSISTED_MESSAGE =
  'This deployment has no database, so it shows the curated demonstrations read-only. New analyses and challenges cannot be saved here.';

/** Test seam. */
export function setStore(store: EvidenceStore | null): void {
  instance = store;
}
