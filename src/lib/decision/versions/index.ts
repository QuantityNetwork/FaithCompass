/**
 * Immutable archive of Decision Twin case versions.
 *
 * Every version a passport may have been issued for stays here, with the
 * canonical SHA-256 of its data pinned at the time it was archived. A
 * passport records its case version and that hash, and is always rebuilt
 * from the archived version it names, never from whatever version is active.
 * Changing a case means adding a new version, not editing an old one.
 */
import { canonicalJson, sha256 } from '../canonical';
import * as V1 from './v1';

export interface ArchivedCaseData {
  version: string;
  ruleset: string;
  /** Where the data is archived in the source tree. */
  path: string;
  case: { id: string; title: string; borrower: string; question: string; label: string; facility: unknown } & Record<string, unknown>;
  documents: readonly V1.CaseDocument[];
}

export function archiveHash(d: Pick<ArchivedCaseData, 'version' | 'ruleset' | 'case' | 'documents'>): string {
  return sha256(canonicalJson({ version: d.version, ruleset: d.ruleset, case: d.case, documents: d.documents }));
}

export const ARCHIVED_CASES: Record<string, { data: ArchivedCaseData; sha256: string }> = {
  '1.0.0': {
    data: { version: V1.CASE_VERSION, ruleset: V1.RULESET_VERSION, path: 'src/lib/decision/versions/v1.ts', case: V1.CASE, documents: V1.DOCUMENTS },
    // Pinned when v1.0.0 was archived (2026-10-20). Never update this value; add a new version instead.
    sha256: '248623021f23b82b9f1921142a9a49b6ea1239ead04b7c22b53502f7be9c7caf',
  },
};

export const ACTIVE_CASE_VERSION = V1.CASE_VERSION;
