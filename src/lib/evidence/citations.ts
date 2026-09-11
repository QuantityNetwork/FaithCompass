/**
 * Citation verification.
 *
 * A generated citation is treated as a claim about the world until it resolves
 * against a curated corpus record. Anything that does not resolve is dropped
 * from the evidence ledger and recorded as a flag — it is never quietly
 * downgraded into a plausible-looking footnote.
 */

import { getCorpusEntry, type CorpusEntry } from './corpus';
import type { Source } from './schema';
import type { VerificationState } from './taxonomy';

export interface CitationFlag {
  sourceRef: string;
  reason: string;
}

export interface VerificationOutcome {
  sources: Source[];
  flags: CitationFlag[];
}

/**
 * Verification state of a corpus-resident record.
 *
 * A record that lives in the corpus is at least an INTERNAL_CORPUS record. It
 * is upgraded when it carries an external identifier, and only reaches VERIFIED
 * when an external catalogue check has actually been performed and recorded on
 * the entry. Nothing is promoted to VERIFIED by the mere act of citing it.
 */
export function verificationStateFor(entry: CorpusEntry): VerificationState {
  if (entry.verified === 'VERIFIED' || entry.verified === 'UNVERIFIED') return entry.verified;
  const hasExternalId = Boolean(entry.isbn || entry.doi || entry.archiveReference || entry.url);
  return hasExternalId ? 'PARTIALLY_VERIFIED' : 'INTERNAL_CORPUS';
}

export function toSource(entry: CorpusEntry): Source {
  return {
    id: entry.id,
    title: entry.title,
    author: entry.author,
    publication: entry.publication,
    date: entry.date,
    sourceType: entry.sourceType,
    qualityTier: entry.qualityTier,
    traditionPerspective: entry.traditionPerspective,
    url: entry.url ?? null,
    doi: entry.doi ?? null,
    isbn: entry.isbn ?? null,
    archiveReference: entry.archiveReference ?? null,
    citation: entry.citation,
    verified: verificationStateFor(entry),
    reliabilityAssessment: entry.reliabilityAssessment,
    independence: entry.independence,
  };
}

/**
 * Resolve proposed source references against the corpus.
 *
 * Returns only the sources that resolved, plus a flag for each that did not.
 * Callers must surface the flags; an analysis that silently swallowed them
 * would present a thinner evidence base as if it were the intended one.
 */
export function verifyCitations(sourceRefs: string[]): VerificationOutcome {
  const sources: Source[] = [];
  const flags: CitationFlag[] = [];
  const seen = new Set<string>();

  for (const ref of sourceRefs) {
    if (seen.has(ref)) continue;
    seen.add(ref);

    const entry = getCorpusEntry(ref);
    if (!entry) {
      flags.push({
        sourceRef: ref,
        reason:
          'No corpus record matches this reference. The citation could not be independently verified and has been excluded from the evidence ledger.',
      });
      continue;
    }
    sources.push(toSource(entry));
  }

  return { sources, flags };
}

/** Whether a source may be displayed as carrying evidential authority. */
export function isDisplayableAsAuthoritative(source: Source): boolean {
  return source.verified === 'VERIFIED' || source.verified === 'PARTIALLY_VERIFIED';
}

export function verificationCaveat(source: Source): string | null {
  switch (source.verified) {
    case 'UNVERIFIED':
      return 'Source could not be independently verified.';
    case 'INTERNAL_CORPUS':
      return 'Internal corpus record. Not reconciled against an external catalogue.';
    case 'PARTIALLY_VERIFIED':
      return 'Bibliographic identifiers present; no live catalogue check has been run.';
    default:
      return null;
  }
}
