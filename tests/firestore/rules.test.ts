/**
 * firestore.rules against the emulator: the six roles, tenant isolation and the editorial rules.
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

  it('nobody writes the canonical record or the audit log directly, whatever their role', async () => {
    for (const t of [contributor, editor, admin, sysadmin, reviewer]) {
      expect(await client.commit(t, [{ path: 'evidence_analyses/a1', data: { json: '{"changed":true}' } }])).toBe(DENIED);
      expect(await client.commit(t, [{ path: 'evidence_challenges/ch1', data: { json: '{}' } }])).toBe(DENIED);
      expect(await client.commit(t, [{ path: 'evidence_audit/x1', data: { json: 'tampered' } }])).toBe(DENIED);
      expect(await client.commit(t, [{ path: 'evidence_audit/x1', data: {}, del: true }])).toBe(DENIED);
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
    expect(
      await client.commit(contributor, [
        { path: 'evidence_challenge_proposals/p-alice', data: { ...proposal('alice'), status: 'approved', decidedBy: 'alice', decisionAuditId: 'au1' } },
        { path: 'evidence_audit/au1', data: { json: '{}', entityType: 'PROPOSAL', entityId: 'p-alice', actorId: 'alice' }, exists: false },
      ]),
    ).toBe(DENIED);
  });

  it('research_editor: decides another person’s proposal only with an audit event in the same batch', async () => {
    const decide = (pid: string, by: string, auditId: string, withAudit = true) => [
      { path: `evidence_challenge_proposals/${pid}`, data: { ...proposal(pid === 'p-ed' ? 'ed' : 'alice'), status: 'approved', decidedBy: by, decisionAuditId: auditId } },
      ...(withAudit ? [{ path: `evidence_audit/${auditId}`, data: { json: '{}', entityType: 'PROPOSAL', entityId: pid, actorId: by }, exists: false }] : []),
    ];
    // Without the audit event: denied
    expect(await client.commit(editor, decide('p-alice', 'ed', 'au0', false))).toBe(DENIED);
    // Recorded as someone else: denied
    expect(await client.commit(editor, decide('p-alice', 'someone', 'au0'))).toBe(DENIED);
    // The editor is not the proposer: own proposal denied
    expect(await client.commit(editor, decide('p-ed', 'ed', 'au2'))).toBe(DENIED);
    // Changing the proposal body while deciding: denied
    expect(
      await client.commit(editor, [
        { path: 'evidence_challenge_proposals/p-alice', data: { ...proposal('alice'), json: '{"rewritten":true}', status: 'approved', decidedBy: 'ed', decisionAuditId: 'au3' } },
        { path: 'evidence_audit/au3', data: { json: '{}', entityType: 'PROPOSAL', entityId: 'p-alice', actorId: 'ed' }, exists: false },
      ]),
    ).toBe(DENIED);
    // Correct decision: allowed
    expect(await client.commit(editor, decide('p-alice', 'ed', 'au1'))).toBe(OK);
    // Decided proposals cannot be decided again, and the audit event cannot be changed afterwards
    expect(await client.commit(editor, decide('p-alice', 'ed', 'au4'))).toBe(DENIED);
    expect(await client.commit(editor, [{ path: 'evidence_audit/au1', data: { json: 'edited', entityType: 'PROPOSAL', entityId: 'p-alice', actorId: 'ed' } }])).toBe(DENIED);
    expect(await client.get(editor, 'evidence_challenge_proposals/p-ed')).toBe(OK);
  });

  it('system_admin: reads the audit log, has no editorial authority', async () => {
    expect(await client.get(sysadmin, 'evidence_audit/x1')).toBe(OK);
    expect(
      await client.commit(sysadmin, [
        { path: 'evidence_challenge_proposals/p-alice', data: { ...proposal('alice'), status: 'approved', decidedBy: 'sam', decisionAuditId: 'au5' } },
        { path: 'evidence_audit/au5', data: { json: '{}', entityType: 'PROPOSAL', entityId: 'p-alice', actorId: 'sam' }, exists: false },
      ]),
    ).toBe(DENIED);
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
