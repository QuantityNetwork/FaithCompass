/**
 * The AbrahamMoses corpus.
 *
 * Evidence Intelligence resolves every citation against this registry. A model
 * may propose evidence, but it may only cite a source that exists here — which
 * is the mechanism that prevents invented manuscripts, invented excavation
 * reports and invented scholarly consensus from reaching the database.
 *
 * The registry is deliberately small and hand-entered. Growing it is a curation
 * task, not a generation task: entries are added when a real record has been
 * checked, not when a model mentions something plausible.
 */

import type {
  SourceTier,
  SourceType,
  TraditionPerspective,
  VerificationState,
} from '../taxonomy';

export interface CorpusEntry {
  id: string;
  title: string;
  author: string | null;
  publication: string | null;
  date: string | null;
  sourceType: SourceType;
  qualityTier: SourceTier;
  traditionPerspective: TraditionPerspective;
  citation: string;
  archiveReference?: string | null;
  url?: string | null;
  isbn?: string | null;
  doi?: string | null;
  /**
   * How this record was checked. INTERNAL_CORPUS means the record is a curated
   * corpus entry that has not been reconciled against an external catalogue.
   */
  verified: VerificationState;
  reliabilityAssessment: string;
  /**
   * Independence from other corpus entries. Sources sharing a common ancestor —
   * a chronicler copying an earlier chronicler — are scored down here so the
   * engine does not count one testimony twice.
   */
  independence: number;
  /** Language, tradition, genre and provenance metadata for corpus filtering. */
  language?: string;
  genre?: string;
  provenance?: string;
  /** Ids of corpus entries this one depends on textually. */
  dependsOn?: string[];
  /** Latest date, as a year, for "evidence before AD 500" style filters. */
  yearApprox?: number;
}

import { CORPUS_ENTRIES } from './documents';

const BY_ID = new Map<string, CorpusEntry>(CORPUS_ENTRIES.map((e) => [e.id, e]));

export function getCorpusEntry(id: string): CorpusEntry | undefined {
  return BY_ID.get(id);
}

export function allCorpusEntries(): CorpusEntry[] {
  return [...CORPUS_ENTRIES];
}

export interface CorpusFilter {
  tiers?: SourceTier[];
  perspectives?: TraditionPerspective[];
  /** Restrict to sources composed no later than this year. */
  beforeYear?: number;
  primaryOnly?: boolean;
}

export function filterCorpus(filter: CorpusFilter): CorpusEntry[] {
  return CORPUS_ENTRIES.filter((e) => {
    if (filter.primaryOnly && e.qualityTier !== 'A') return false;
    if (filter.tiers && !filter.tiers.includes(e.qualityTier)) return false;
    if (filter.perspectives && !filter.perspectives.includes(e.traditionPerspective)) {
      return false;
    }
    if (
      typeof filter.beforeYear === 'number' &&
      (e.yearApprox === undefined || e.yearApprox > filter.beforeYear)
    ) {
      return false;
    }
    return true;
  });
}

/**
 * Effective independence of a set of cited sources.
 *
 * Two sources that both descend from a third are not two witnesses. This walks
 * the declared dependency graph and discounts an entry that shares an ancestor
 * with another entry in the same set.
 */
export function effectiveIndependence(ids: string[]): Map<string, number> {
  const out = new Map<string, number>();
  const present = new Set(ids);

  for (const id of ids) {
    const entry = BY_ID.get(id);
    if (!entry) {
      out.set(id, 0);
      continue;
    }
    let independence = entry.independence;
    for (const dep of entry.dependsOn ?? []) {
      if (present.has(dep)) {
        // Its source is already counted in this set; this entry adds much less.
        independence *= 0.35;
      }
    }
    out.set(id, Math.max(0, Math.min(1, independence)));
  }
  return out;
}
