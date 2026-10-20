/**
 * The active version of the Private Credit Decision Twin case, and helpers
 * over its documents. The data lives in the immutable archive
 * (versions/v1.ts); see versions/index.ts for how passports resolve the
 * version they were issued for.
 */
import { hashOf } from './canonical';
import { CASE, CASE_ID, CASE_VERSION, DOCUMENTS, RULESET_VERSION, type CaseDocument, type DocField } from './versions/v1';

export { CASE, CASE_ID, CASE_VERSION, DOCUMENTS, RULESET_VERSION };
export type { CaseDocument, DocField };

export function documentHash(doc: CaseDocument): string {
  return hashOf(doc);
}

export function getDocument(id: string): CaseDocument | undefined {
  return DOCUMENTS.find((d) => d.id === id);
}

export function docValue(docId: string, key: string): number {
  const v = getDocument(docId)?.fields.find((f) => f.key === key)?.value;
  if (typeof v !== 'number') throw new Error(`No numeric field ${docId}.${key}`);
  return v;
}

/** The source inventory with content hashes, as cited by passports. */
export function sourceInventory(documents: readonly CaseDocument[] = DOCUMENTS) {
  return documents.map((d) => ({ id: d.id, title: d.title, date: d.date, verification: d.verification, sha256: documentHash(d) }));
}
