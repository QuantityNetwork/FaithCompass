import { JsonEvidenceStore } from './json-store';
import type { EvidenceStore } from './types';

export type { EvidenceStore } from './types';

let instance: EvidenceStore | null = null;

export function getStore(): EvidenceStore {
  instance ??= new JsonEvidenceStore();
  return instance;
}

/** Test seam. */
export function setStore(store: EvidenceStore | null): void {
  instance = store;
}
