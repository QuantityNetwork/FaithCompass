/**
 * Trust labels (2026-10-20): no unearned "published"/editor-verified state, §6.4 epistemic wording in
 * the dependency simulator and its API, no figures on interpretive or theological claims, and an
 * AI-drafted disclosure on every Evidence Intelligence analysis.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { EPISTEMIC_META, EPISTEMIC_STATUSES } from '@/lib/epistemic';
import { resetRateLimits } from '@/lib/api/http';
import { dispatchV1, openApiDocument } from '@/lib/api/v1';
import {
  COUNTER_STATUS_LABELS,
  EDGE_STATUS_LABELS,
  EPISTEMIC_STATUS_OF,
  STATUS_LABELS,
  STATUS_SHORT_LABELS,
} from '@/lib/record/engine';
import { STATUS_CORRECTION_2026_10_20 } from '@/lib/record/data/corrections';
import { checkRecord } from '@/lib/record/integrity';
import { getRecord, revisionHash } from '@/lib/record/record';
import type { RecordData } from '@/lib/record/schema';
import { ensureSeeded } from '@/lib/evidence/bootstrap';
import { getStore } from '@/lib/evidence/store';
import { analysisReviewState, epistemicFromCertainty, isInterpretiveClaim } from '@/lib/evidence/format';
import { CERTAINTY_META } from '@/lib/evidence/taxonomy';
import { ClaimDetail, ClaimHeadline } from '@/components/evidence/claim-detail';

const record = getRecord();
const lock = JSON.parse(readFileSync(join(__dirname, '../src/lib/record/revisions.lock.json'), 'utf8'));
const FORBIDDEN_OUTCOME = /\b(broken|rejected|collapsed?|warrant)\b/i;

describe('review state is never claimed without a reviewer', () => {
  it('has no published or externally reviewed claim revision without a named reviewer', () => {
    for (const claim of record.data.claims) {
      for (const r of claim.revisions) {
        if (r.status === 'published' || r.status === 'externally_reviewed') {
          expect(r.editorial.reviewers.length, `${claim.code}@${r.rev}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('fails integrity when a revision is marked published with no reviewer', () => {
    const data = structuredClone(record.data) as RecordData;
    const target = data.claims.find((c) => c.code === 'AM-CLAIM-000184')!;
    target.revisions[0] = { ...target.revisions[0], status: 'published' };
    const errors = checkRecord(data, record.graph()).filter((f) => f.level === 'error');
    expect(errors.map((e) => e.code)).toContain('unverified_publication');
  });

  it('records the 2026-10-20 status correction with both hashes', () => {
    expect(STATUS_CORRECTION_2026_10_20.revisions).toHaveLength(8);
    for (const c of STATUS_CORRECTION_2026_10_20.revisions) {
      const claim = record.claim(c.code)!;
      const r = record.revision(claim, c.rev)!;
      expect(r.status).toBe('provisional');
      expect(revisionHash(c.code, r)).toBe(c.hash);
      expect(lock[`${c.code}@${c.rev}`]).toBe(c.hash);
      expect(c.previousHash).not.toBe(c.hash);
      expect(record.lastVerified(claim)).toBeUndefined();
    }
  });
});

describe('dependency simulator speaks the epistemic vocabulary', () => {
  it('uses no "broken", "rejected" or "warrant" outcome label', () => {
    for (const map of [STATUS_LABELS, STATUS_SHORT_LABELS, EDGE_STATUS_LABELS, COUNTER_STATUS_LABELS]) {
      for (const label of Object.values(map)) expect(label).not.toMatch(FORBIDDEN_OUTCOME);
    }
    for (const s of Object.values(EPISTEMIC_STATUS_OF)) expect(EPISTEMIC_STATUSES).toContain(s);
    expect(STATUS_LABELS.broken).toBe(EPISTEMIC_META.not_established.label);
    expect(STATUS_LABELS.stands).toBe('Supported under selected assumptions');
  });

  beforeEach(() => resetRateLimits());

  it('adds epistemic_status beside the unchanged legacy status in /simulate', async () => {
    const res = await dispatchV1(
      new Request('https://am.example.test/api/v1/simulate?reject_axioms=AM-AX-002', { headers: { 'x-forwarded-for': 'trust' } }),
      '/simulate',
    );
    const body = await res.json();
    expect(body.epistemic_summary).toBeDefined();
    expect(body.affected.length).toBeGreaterThan(0);
    for (const a of body.affected) {
      expect(['stands', 'weakened', 'unwarranted', 'broken', 'rejected']).toContain(a.status);
      expect(a.epistemic_status).toBe(EPISTEMIC_STATUS_OF[a.status as keyof typeof EPISTEMIC_STATUS_OF]);
    }
    expect(JSON.stringify(body.notice)).not.toMatch(FORBIDDEN_OUTCOME);
  });

  it('documents headline_confidence as deprecated in OpenAPI', () => {
    const doc = JSON.stringify(openApiDocument());
    expect(doc).toMatch(/"headline_confidence":\{[^}]*"deprecated":true/);
    expect(doc).toMatch(/epistemic_status/);
  });
});

describe('Evidence Intelligence', () => {
  it('maps the certainty ladder onto §6.4 wording', () => {
    expect(epistemicFromCertainty('HIGHLY_PROBABLE')).toBe('supported');
    expect(epistemicFromCertainty('PLAUSIBLE')).toBe('partially_supported');
    expect(epistemicFromCertainty('SPECULATIVE')).toBe('insufficient_evidence');
    expect(epistemicFromCertainty('CONTRADICTED')).toBe('not_established');
    expect(epistemicFromCertainty('PROBABLE', 'SIGNIFICANTLY_DISPUTED')).toBe('disputed_interpretation');
    expect(epistemicFromCertainty('NOT_DIRECTLY_SCORABLE')).toBeNull();
  });

  it('discloses AI drafting and shows no figure or probability label on interpretive claims', async () => {
    await ensureSeeded();
    const analyses = await getStore().listAnalyses();
    expect(analyses.length).toBe(5);
    const probabilityLabels = Object.values(CERTAINTY_META).map((m) => m.label);
    let interpretive = 0;
    for (const analysis of analyses) {
      const review = analysisReviewState(analysis);
      expect(review.label).toBe('AI-drafted · awaiting editorial review');
      expect(review.disclosure).toMatch(/not been reviewed by an AbrahamMoses editor/);
      for (const claim of analysis.claims.filter(isInterpretiveClaim)) {
        interpretive++;
        const html =
          renderToStaticMarkup(createElement(ClaimHeadline, { claim })) +
          renderToStaticMarkup(createElement(ClaimDetail, { analysis, claim }));
        expect(html, claim.id).not.toMatch(/\/\s*100/);
        expect(html, claim.id).not.toMatch(/profile__score|claim__verdict-score/);
        if (claim.overallConfidence !== null) expect(html, claim.id).not.toContain(`>${claim.overallConfidence}<`);
        for (const label of probabilityLabels) {
          if (label === CERTAINTY_META.NOT_DIRECTLY_SCORABLE.label) continue;
          expect(html, `${claim.id}: ${label}`).not.toContain(`>${label}<`);
        }
      }
    }
    expect(interpretive).toBeGreaterThan(0);
  });
});
