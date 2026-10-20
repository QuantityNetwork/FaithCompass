/** In-memory EvidenceStore, so tests never touch the filesystem. */
import { MemoryEvidenceStore } from '@/lib/evidence/store/memory-store';
export { MemoryEvidenceStore as MemoryStore } from '@/lib/evidence/store/memory-store';

/**
 * Stands in for a durable database in unit tests, so the write paths can be
 * exercised. It is NOT a database: acceptance tests that depend on Postgres
 * semantics (RLS, transactions across instances) are marked blocked instead.
 */
export class DurableTestStore extends MemoryEvidenceStore {
  override readonly durable: boolean = true;
}
