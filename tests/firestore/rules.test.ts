/**
 * firestore.rules against the emulator: the six roles, tenant isolation and the editorial rules. With no admin key,
 * these rules are the only guard on every write.
 * Runs only under `npm run test:firestore` (FIRESTORE_EMULATOR_HOST set); skipped otherwise.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { ON_EMULATOR, clearEmulator, client, mockToken, seed } from './emulator';

const OK = 200;
const DENIED = 403;

const contributor = mockToken('alice', { am_role: 'research_contributor' });
const contributorNoClaim = mockToken('carol');
const editor = mockToken('ed', { am_role: 'research_editor' });
const admin = mockToken('ada', { am_role: 'editorial_admin' });
const sysadmin = mockToken('sam', { am_role: 'system_admin' });
const reviewer = mockToken('rev', { am_role: 'scholarly_reviewer' });
const anonymousAuth = mockToken('anon-1', {}, 'anonymous');

const decisionAudit = (pid: string, by: string, changeType = 'APPROVED') => ({ json: '{}', entityType: 'CLAIM', entityId: 'c1', changeType, actorId: by, proposalId: pid });
const decided = (by: string, actor: string, auditId: string, status = 'approved') => ({ ...proposal(by), status, decidedBy: actor, decisionAuditId: auditId });
const approval = (pid: string, by: string, actor: string, auditId: string) => [
  { path: `evidence_challenge_proposals/${pid}`, data: decided(by, actor, auditId) },
  { path: `evidence_audit/${auditId}`, data: decisionAudit(pid, actor), exists: false },
  { path: 'evidence_analyses/a1', data: { json: '{"revised":true}', title: 'A', lastProposalId: pid, lastAuditId: auditId } },
  { path: `evidence_challenges/ch-${auditId}`, data: { json: '{}', claimId: 'c1', analysisId: 'a1', proposalId: pid }, exists: false },
];
const proposal = (by: string | null) => ({ json: '{}', claimId: 'c1', analysisId: 'a1', status: 'proposed', proposedBy: by, proposerRole: 'research_contributor', idempotencyKey: null, decidedBy: null, createdAt: '2026-10-20T00:00:00Z' });

describe.skipIf(!ON_EMULATOR)('Firestore security rules (emulator)', () => {
  beforeEach(async () => {
    await clearEmulator();
    await seed('evidence_analyses/a1', { json: '{}', title: 'A' });
    await seed('evidence_challenge_proposals/p-alice', proposal('alice'));
    await seed('evidence_challenge_proposals/p-ed', proposal('ed'));
    await seed('evidence_audit/x1', { json: '{}', entityType: 'ANALYSIS', entityId: 'a1', actorId: null });
  });

  it('public reader: reads the canonical record, writes nothing', async () => {
    expect(await client.get(null, 'evidence_analyses/a1')).toBe(OK);
    expect(await client.commit(null, [{ path: 'evidence_analyses/a2', data: { json: '{}' } }])).toBe(DENIED);
    expect(await client.commit(null, [{ path: 'evidence_challenge_proposals/p-new', data: proposal(null) }])).toBe(DENIED);
    expect(await client.commit(null, [{ path: 'evidence_analysis_drafts/d1', data: { json: '{}', createdBy: null } }])).toBe(DENIED);
    expect(await client.get(null, 'evidence_audit/x1')).toBe(DENIED);
  });

  it('anonymous-auth users are public readers: no writes', async () => {
    expect(await client.commit(anonymousAuth, [{ path: 'evidence_challenge_proposals/p-anon', data: proposal('anon-1') }])).toBe(DENIED);
  });

  it('nobody writes the canonical record outside an approval, and nobody edits or deletes the audit log', async () => {
    for (const t of [contributor, editor, admin, sysadmin, reviewer]) {
      expect(await client.commit(t, [{ path: 'evidence_analyses/a1', data: { json: '{"changed":true}', lastProposalId: null, lastAuditId: null } }])).toBe(DENIED);
      // Naming an undecided proposal is not enough: the approval must happen in the same batch
      expect(await client.commit(t, [{ path: 'evidence_analyses/a1', data: { json: '{"changed":true}', lastProposalId: 'p-alice', lastAuditId: 'x1' } }])).toBe(DENIED);
      expect(await client.commit(t, [{ path: 'evidence_challenges/ch1', data: { json: '{}', proposalId: 'p-alice', claimId: 'c1' } }])).toBe(DENIED);
      expect(await client.commit(t, [{ path: 'evidence_audit/x1', data: { json: 'tampered' } }])).toBe(DENIED);
      expect(await client.commit(t, [{ path: 'evidence_audit/x1', data: {}, del: true }])).toBe(DENIED);
      expect(await client.commit(t, [{ path: 'evidence_audit/y-' + t.length, data: decisionAudit('p-alice', 'ed'), exists: false }])).toBe(DENIED);
    }
  });

  it('research_contributor: creates own proposals and drafts as themselves only', async () => {
    expect(await client.commit(contributor, [{ path: 'evidence_challenge_proposals/p2', data: proposal('alice'), exists: false }])).toBe(OK);
    expect(await client.commit(contributor, [{ path: 'evidence_challenge_proposals/p3', data: proposal('bob'), exists: false }])).toBe(DENIED);
    expect(await client.commit(contributor, [{ path: 'evidence_challenge_proposals/p4', data: { ...proposal('alice'), status: 'approved' } }])).toBe(DENIED);
    // An account without a role claim is a contributor, never more
    expect(await client.commit(contributorNoClaim, [{ path: 'evidence_challenge_proposals/p5', data: proposal('carol'), exists: false }])).toBe(OK);
    expect(await client.commit(contributor, [{ path: 'evidence_analysis_drafts/d1', data: { json: '{}', createdBy: 'alice' } }])).toBe(OK);
    expect(await client.commit(contributor, [{ path: 'evidence_analysis_drafts/d2', data: { json: '{}', createdBy: 'bob' } }])).toBe(DENIED);
    expect(await client.get(contributor, 'evidence_challenge_proposals/p-alice')).toBe(OK);
    expect(await client.get(contributor, 'evidence_challenge_proposals/p-ed')).toBe(DENIED);
    expect(await client.get(contributor, 'evidence_audit/x1')).toBe(DENIED);
  });

  it('a contributor cannot decide, not even their own proposal', async () => {
    expect(await client.commit(contributor, approval('p-alice', 'alice', 'alice', 'au1'))).toBe(DENIED);
    expect(await client.commit(contributor, approval('p-ed', 'ed', 'alice', 'au1'))).toBe(DENIED);
  });

  it('research_editor: approves another person’s proposal atomically with its audit event and the revised record', async () => {
    // Without the audit event: denied
    expect(await client.commit(editor, approval('p-alice', 'alice', 'ed', 'au0').filter((w) => !w.path.startsWith('evidence_audit')))).toBe(DENIED);
    // Recorded as someone else: denied
    expect(await client.commit(editor, approval('p-alice', 'alice', 'someone', 'au0'))).toBe(DENIED);
    // The editor is never the proposer
    expect(await client.commit(editor, approval('p-ed', 'ed', 'ed', 'au2'))).toBe(DENIED);
    // Changing the proposal body while deciding: denied
    const rewritten = approval('p-alice', 'alice', 'ed', 'au3');
    rewritten[0] = { path: 'evidence_challenge_proposals/p-alice', data: { ...decided('alice', 'ed', 'au3'), json: '{"rewritten":true}' } };
    expect(await client.commit(editor, rewritten)).toBe(DENIED);
    // An audit event pointing at another proposal: denied
    const crossed = approval('p-alice', 'alice', 'ed', 'au6');
    crossed[1] = { path: 'evidence_audit/au6', data: decisionAudit('p-ed', 'ed'), exists: false };
    expect(await client.commit(editor, crossed)).toBe(DENIED);
    // Correct approval: allowed, all four writes together
    expect(await client.commit(editor, approval('p-alice', 'alice', 'ed', 'au1'))).toBe(OK);
    // Decided proposals cannot be decided again; the record cannot be rewritten on the old approval; the audit is frozen
    expect(await client.commit(editor, approval('p-alice', 'alice', 'ed', 'au4'))).toBe(DENIED);
    expect(await client.commit(editor, [{ path: 'evidence_analyses/a1', data: { json: '{"again":true}', lastProposalId: 'p-alice', lastAuditId: 'au1' } }])).toBe(DENIED);
    expect(await client.commit(editor, [{ path: 'evidence_audit/au1', data: { ...decisionAudit('p-alice', 'ed'), json: 'edited' } }])).toBe(DENIED);
    expect(await client.get(editor, 'evidence_challenge_proposals/p-ed')).toBe(OK);
  });

  it('research_editor: rejects or supersedes with an audit event and without touching the record', async () => {
    await seed('evidence_challenge_proposals/p-bob', proposal('bob'));
    expect(
      await client.commit(editor, [
        { path: 'evidence_challenge_proposals/p-alice', data: decided('alice', 'ed', 'au7', 'rejected') },
        { path: 'evidence_audit/au7', data: decisionAudit('p-alice', 'ed', 'REJECTED'), exists: false },
      ]),
    ).toBe(OK);
    expect(
      await client.commit(editor, [
        { path: 'evidence_challenge_proposals/p-bob', data: decided('bob', 'ed', 'au8', 'superseded') },
        { path: 'evidence_audit/au8', data: decisionAudit('p-bob', 'ed', 'UPDATED'), exists: false },
      ]),
    ).toBe(OK);
    // A rejection cannot carry a record change
    await seed('evidence_challenge_proposals/p-carl', proposal('carl'));
    expect(
      await client.commit(editor, [
        { path: 'evidence_challenge_proposals/p-carl', data: decided('carl', 'ed', 'au9', 'rejected') },
        { path: 'evidence_audit/au9', data: decisionAudit('p-carl', 'ed', 'REJECTED'), exists: false },
        { path: 'evidence_analyses/a1', data: { json: '{"sneaky":true}', lastProposalId: 'p-carl', lastAuditId: 'au9' } },
      ]),
    ).toBe(DENIED);
  });

  it('audit events are attributed to their author: own proposal and own draft only', async () => {
    const ev = (changeType: string, entityType: string, entityId: string, actorId: string) => ({ json: '{}', entityType, entityId, changeType, actorId, proposalId: entityType === 'PROPOSAL' ? entityId : null });
    expect(await client.commit(contributor, [{ path: 'evidence_audit/e1', data: ev('PROPOSED', 'PROPOSAL', 'p-alice', 'alice'), exists: false }])).toBe(OK);
    expect(await client.commit(contributor, [{ path: 'evidence_audit/e2', data: ev('PROPOSED', 'PROPOSAL', 'p-ed', 'alice'), exists: false }])).toBe(DENIED);
    expect(await client.commit(contributor, [{ path: 'evidence_audit/e3', data: ev('PROPOSED', 'PROPOSAL', 'p-alice', 'ed'), exists: false }])).toBe(DENIED);
    expect(await client.commit(contributor, [{ path: 'evidence_analysis_drafts/d9', data: { json: '{}', createdBy: 'alice' } }])).toBe(OK);
    expect(await client.commit(contributor, [{ path: 'evidence_audit/e4', data: ev('DRAFTED', 'DRAFT', 'd9', 'alice'), exists: false }])).toBe(OK);
    expect(await client.commit(editor, [{ path: 'evidence_audit/e5', data: ev('DRAFTED', 'DRAFT', 'd9', 'ed'), exists: false }])).toBe(DENIED);
    expect(await client.commit(null, [{ path: 'evidence_audit/e6', data: ev('PROPOSED', 'PROPOSAL', 'p-alice', 'alice'), exists: false }])).toBe(DENIED);
  });

  it('system_admin: reads the audit log, has no editorial authority', async () => {
    expect(await client.get(sysadmin, 'evidence_audit/x1')).toBe(OK);
    expect(await client.commit(sysadmin, approval('p-alice', 'alice', 'sam', 'au5'))).toBe(DENIED);
    expect(await client.commit(sysadmin, [{ path: 'review_assignments/r1', data: { reviewerId: 'rev', status: 'open' } }])).toBe(DENIED);
  });

  it('editorial_admin assigns reviewers (not themselves); scholarly_reviewer attests only for self on an open assignment', async () => {
    expect(await client.get(admin, 'evidence_audit/x1')).toBe(OK);
    expect(await client.commit(admin, [{ path: 'review_assignments/r1', data: { reviewerId: 'rev', status: 'open' } }])).toBe(OK);
    expect(await client.commit(admin, [{ path: 'review_assignments/r2', data: { reviewerId: 'ada', status: 'open' } }])).toBe(DENIED);
    expect(await client.commit(editor, [{ path: 'review_assignments/r3', data: { reviewerId: 'rev', status: 'open' } }])).toBe(DENIED);
    expect(await client.commit(reviewer, [{ path: 'attestations/t1', data: { reviewerId: 'rev', assignmentId: 'r1' }, exists: false }])).toBe(OK);
    expect(await client.commit(reviewer, [{ path: 'attestations/t1', data: { reviewerId: 'rev', assignmentId: 'r1', note: 'edited' } }])).toBe(DENIED);
    expect(await client.commit(reviewer, [{ path: 'attestations/t2', data: { reviewerId: 'other', assignmentId: 'r1' }, exists: false }])).toBe(DENIED);
    await seed('review_assignments/r9', { reviewerId: 'rev', status: 'closed' });
    expect(await client.commit(reviewer, [{ path: 'attestations/t3', data: { reviewerId: 'rev', assignmentId: 'r9' }, exists: false }])).toBe(DENIED);
    expect(await client.commit(editor, [{ path: 'attestations/t4', data: { reviewerId: 'ed', assignmentId: 'r1' }, exists: false }])).toBe(DENIED);
  });

  it('tenants are isolated, and members cannot change membership', async () => {
    await seed('tenants/t1', { name: 'Tenant 1' });
    await seed('tenants/t1/members/alice', { role: 'member' });
    await seed('tenants/t2', { name: 'Tenant 2' });
    await seed('tenants/t2/cases/c1', { title: 'secret' });
    expect(await client.get(contributor, 'tenants/t1')).toBe(OK);
    expect(await client.commit(contributor, [{ path: 'tenants/t1/cases/c1', data: { title: 'mine' } }])).toBe(OK);
    expect(await client.get(contributor, 'tenants/t2')).toBe(DENIED);
    expect(await client.get(contributor, 'tenants/t2/cases/c1')).toBe(DENIED);
    expect(await client.commit(contributor, [{ path: 'tenants/t2/cases/c2', data: { title: 'x' } }])).toBe(DENIED);
    expect(await client.commit(contributor, [{ path: 'tenants/t1/members/bob', data: { role: 'member' } }])).toBe(DENIED);
    expect(await client.commit(contributor, [{ path: 'tenants/t2/members/alice', data: { role: 'member' } }])).toBe(DENIED);
    expect(await client.commit(null, [{ path: 'tenants/t1/cases/c3', data: { title: 'x' } }])).toBe(DENIED);
  });
});
