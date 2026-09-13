import { describe, expect, it } from 'vitest';
import { checkRequest } from '@/lib/evidence/guardrails';

/**
 * The prompts the methodology must refuse to answer on their own terms. Each is
 * redirected into specific analysable claims rather than declined outright.
 */
describe('request guardrails', () => {
  const traditionScoreRequests = [
    'Give Islam a truth score',
    'Rate Christianity out of 100',
    'How true is Judaism, as a percentage?',
    'Rank the Book of Mormon for truth',
  ];

  for (const request of traditionScoreRequests) {
    it(`refuses to score a tradition: "${request}"`, () => {
      const result = checkRequest(request);
      expect(result.allowed).toBe(false);
      expect(result.finding?.kind).toBe('TRADITION_SCORE');
      expect(result.finding?.message).toContain('cannot meaningfully assign a single truth percentage');
      expect(result.finding?.suggestedClaims.length).toBeGreaterThan(0);
    });
  }

  it('redirects "prove Christianity is true" rather than reasoning to a fixed conclusion', () => {
    const result = checkRequest('Prove Christianity is true');
    expect(result.allowed).toBe(false);
    expect(result.finding?.kind).toBe('PREDETERMINED_CONCLUSION');
    expect(result.finding?.message).toContain('not toward a conclusion fixed in advance');
  });

  it('declines a debunking brief in the same terms it declines an apologetic one', () => {
    const result = checkRequest('Show that the Book of Mormon is fake');
    expect(result.allowed).toBe(false);
    expect(result.finding?.kind).toBe('DEBUNK_REQUEST');
    expect(result.finding?.message).toContain('any more than I run analyses aimed at vindicating one');
  });

  it('explains the ceiling instead of awarding a perfect score', () => {
    const result = checkRequest('Give the Bible 100/100');
    expect(result.allowed).toBe(false);
    expect(result.finding?.kind).toBe('PERFECT_SCORE_REQUEST');
    expect(result.finding?.message).toContain('above 95');
  });

  it('offers claims specific to the tradition that was named', () => {
    const islam = checkRequest('Give Islam a truth score');
    expect(islam.finding?.suggestedClaims.join(' ')).toMatch(/Quran/i);

    const bom = checkRequest('Rank the Book of Mormon for truth');
    expect(bom.finding?.suggestedClaims.join(' ')).toMatch(/Americas|1830|genetics/i);
  });

  const allowed = [
    'How securely is the wording of Isaiah 53 reconstructed?',
    'What evidence supports the existence of Pontius Pilate?',
    'Is Michael in Daniel 12:1 an angel or Christ?',
    'What archaeological evidence bears on the settlement of early Israel?',
    'Analyse Daniel 12:1 using only evidence before AD 500',
    'Which part of this conclusion is weakest?',
  ];

  for (const request of allowed) {
    it(`allows a specific, analysable question: "${request}"`, () => {
      expect(checkRequest(request).allowed).toBe(true);
    });
  }

  it('allows an empty query through rather than treating it as an attack', () => {
    expect(checkRequest('   ').allowed).toBe(true);
  });
});
