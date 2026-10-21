/**
 * Decision Room as a working space: the pure room logic (evidence resolution, contradictions touching cited
 * passages, the evidence-withdrawal counterfactual, the two-person review state) and the Institutional menu.
 */
import { describe, expect, it } from 'vitest';
import {
  ENTITY_ID,
  TENANT_ID,
  counterfactual,
  documentText,
  implicatedCitations,
  parseRoomParams,
  quoteTouchesPassage,
  resolveEvidence,
  reviewActions,
  reviewOf,
  roomHref,
  type RoomDecision,
  type RoomDocument,
} from '@/lib/decision-room/room';
import { DECISION_PASSPORT_HUB, FOOTER_NAV, NAV_SECTIONS } from '@/lib/site/nav';
import * as model from '@/lib/workspace/model';

const doc = (id: string, texts: string[]): RoomDocument => ({
  id,
  title: `Doc ${id}`,
  filename: `${id}.md`,
  textSha256: 'f'.repeat(64),
  passages: texts.map((text, i) => ({ n: i + 1, text, sha256: `${id}-${i + 1}` })),
});
const memo = doc('doc_memo01', ['Para one introduces the facility.', 'Two readers are required for every credit approval above the limit.', 'Para three.']);
const terms = doc('doc_terms1', ['The facility is senior secured.', 'Leverage must stay below 4.0x at all times.']);
const docs = new Map([memo, terms].map((d) => [d.id, d]));
const decision: RoomDecision = {
  id: 'dec_abc123',
  title: 'Approve facility',
  question: 'Approve?',
  conclusion: 'Yes',
  rationale: '',
  status: 'proposed',
  evidence: [
    { documentId: 'doc_memo01', passage: 2, passageSha256: 'doc_memo01-2', note: 'rule' },
    { documentId: 'doc_terms1', passage: 2, passageSha256: 'stale-hash', note: 'covenant' },
    { documentId: 'doc_gone01', passage: 1, passageSha256: 'x', note: '' },
  ],
  proposedBy: 'alice',
  proposedByEmail: 'alice@example.invalid',
  proposedAt: '2026-10-21T10:00:00Z',
  decidedBy: null,
  decidedByEmail: null,
  decidedAt: null,
  decisionNote: null,
};

describe('decision room logic', () => {
  it('uses the same id formats as the workspace store', () => {
    expect(TENANT_ID.source).toBe(model.TENANT_ID.source);
    expect(ENTITY_ID.source).toBe(model.ENTITY_ID.source);
    expect(parseRoomParams({ w: 'ws-a', d: 'dec_abc123' })).toEqual({ w: 'ws-a', d: 'dec_abc123' });
    expect(parseRoomParams({ w: '../x', d: 'dec_abc123' })).toBeNull();
    expect(parseRoomParams({ w: 'ws-a', d: ['a', 'b'] })).toBeNull();
    expect(roomHref('ws-a', 'dec_abc123')).toBe('/institutional/decision-room?w=ws-a&d=dec_abc123');
  });

  it('resolves each citation to its passage and checks it is unchanged', () => {
    const c = resolveEvidence(decision, docs);
    expect(c.map((x) => x.intact)).toEqual([true, false, null]);
    expect(c[0].text).toContain('Two readers');
    expect(c[2].documentTitle).toBeNull();
    expect(documentText(memo)).toBe(memo.passages.map((p) => p.text).join('\n\n'));
  });

  it('marks cited passages that a contradiction quotes', () => {
    expect(quoteTouchesPassage('two readers are  required for every credit', 'Two readers are required for every credit approval above the limit.')).toBe(true);
    expect(quoteTouchesPassage('short', 'Two readers are required.')).toBe(false);
    const c = resolveEvidence(decision, docs);
    expect([...implicatedCitations(c, ['Leverage must stay below 4.0x'])]).toEqual([1]);
    expect(implicatedCitations(c, []).size).toBe(0);
  });

  it('shows what the decision rests on when citations are withdrawn, without re-deciding', () => {
    const c = resolveEvidence(decision, docs);
    const none = counterfactual(c, new Set(), new Set([1]));
    expect(none).toMatchObject({ withdrawn: 0, remaining: 3, unsupported: false });
    const one = counterfactual(c, new Set([0]), new Set([1]));
    expect(one).toMatchObject({ remaining: 2, remainingContested: 1, droppedDocuments: ['doc_memo01'], unsupported: false });
    expect(one.summary).toMatch(/for the reviewers to judge/);
    const all = counterfactual(c, new Set([0, 1, 2]), new Set());
    expect(all.unsupported).toBe(true);
    expect(all.summary).toMatch(/No cited evidence would remain/);
  });

  it('reports the two-person review honestly', () => {
    expect(reviewOf(decision)).toMatchObject({ state: 'awaiting', twoPersonRule: null });
    expect(reviewOf({ ...decision, status: 'approved', decidedBy: 'bob' })).toMatchObject({ state: 'approved', twoPersonRule: true });
    expect(reviewOf({ ...decision, status: 'approved', decidedBy: 'alice' }).twoPersonRule).toBe(false);
    expect(reviewActions(decision, 'alice', 'editor').canReview).toBe(false);
    expect(reviewActions(decision, 'bob', 'member').canReview).toBe(false);
    expect(reviewActions(decision, 'bob', 'editor').canReview).toBe(true);
    expect(reviewActions({ ...decision, status: 'rejected' }, 'bob', 'editor').canReview).toBe(false);
  });
});

describe('institutional menu', () => {
  const inst = NAV_SECTIONS.find((s) => s.href === '/institutional')!;
  it('has clean labels, Deep Analysis, and no dead Decision Passport link before the hub exists', () => {
    for (const s of NAV_SECTIONS) for (const p of s.pages) expect(p.label, p.label).not.toMatch(/\((proposed|demo|pilot)\)|\bpilot\b/i);
    expect(inst.pages.map((p) => p.label)).toContain('Deep Analysis');
    expect(inst.pages.find((p) => p.label === 'Deep Analysis')!.href).toBe('/institutional/workspace/deep-analysis');
    const hasPassport = inst.pages.some((p) => p.href === DECISION_PASSPORT_HUB.href);
    expect(hasPassport).toBe(DECISION_PASSPORT_HUB.live);
    expect(FOOTER_NAV.find((c) => c.title === 'Institutional')!.links).toEqual(inst.pages);
  });
});
