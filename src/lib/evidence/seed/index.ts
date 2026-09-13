import { DANIEL_12_1 } from './daniel-12-1';
import { DANIEL_9_SEVENTY_WEEKS } from './daniel-9-seventy-weeks';
import { RESURRECTION } from './resurrection';
import { BOOK_OF_MORMON_MIGRATION } from './book-of-mormon';
import { PONTIUS_PILATE } from './pontius-pilate';
import type { SeededSubject } from './types';

export type { SeededSubject, SeededClaim } from './types';

export const SEEDED_SUBJECTS: SeededSubject[] = [
  DANIEL_12_1,
  DANIEL_9_SEVENTY_WEEKS,
  RESURRECTION,
  PONTIUS_PILATE,
  BOOK_OF_MORMON_MIGRATION,
];

const BY_SLUG = new Map(SEEDED_SUBJECTS.map((s) => [s.slug, s]));

export function seededBySlug(slug: string): SeededSubject | undefined {
  return BY_SLUG.get(slug.replace(/^\/+|\/+$/g, ''));
}

/**
 * Exact index from claim statement to the subject that contains it.
 *
 * Assessment requests carry a claim statement rather than a query, and
 * resolving those by alias is unsafe: a resurrection claim mentioning Pontius
 * Pilate would match the Pilate subject and be assessed against the wrong
 * material. An exact statement lookup cannot do that.
 */
const BY_CLAIM_STATEMENT = new Map<string, SeededSubject>();
for (const subject of SEEDED_SUBJECTS) {
  for (const claim of subject.claims) {
    if (BY_CLAIM_STATEMENT.has(claim.statement)) {
      throw new Error(
        `Duplicate seeded claim statement across subjects: "${claim.statement}". Claim statements are used as exact lookup keys and must be unique.`,
      );
    }
    BY_CLAIM_STATEMENT.set(claim.statement, subject);
  }
}

export function seededByClaimStatement(statement: string): SeededSubject | undefined {
  return BY_CLAIM_STATEMENT.get(statement);
}

/**
 * Resolve a free-text query to a seeded subject.
 *
 * Matching is deliberately conservative: an alias must actually appear in the
 * query. A near-miss returns nothing, and the caller reports that no analysis is
 * available — which is the correct answer, and better than serving a
 * confidently-formatted assessment of the wrong subject.
 */
export function seededByQuery(query: string): SeededSubject | undefined {
  const q = query.toLowerCase().trim();
  if (!q) return undefined;

  let best: { subject: SeededSubject; length: number } | undefined;
  for (const subject of SEEDED_SUBJECTS) {
    for (const alias of subject.aliases) {
      if (q.includes(alias) && (!best || alias.length > best.length)) {
        best = { subject, length: alias.length };
      }
    }
  }
  return best?.subject;
}
