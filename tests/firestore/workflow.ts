/** Shared actors and the full editorial workflow, run with users' own ID tokens under firestore.rules. */
import { withIdToken, type Actor } from '@/lib/auth/actor';
import { runAnalysis } from '@/lib/evidence/pipeline';
import { CorpusReasoningProvider } from '@/lib/evidence/providers/corpus';
import { decideProposal, proposeChallenge } from '@/lib/evidence/revisions';
import { DANIEL_12_1 } from '@/lib/evidence/seed/daniel-12-1';
import { storeFor } from '@/lib/evidence/store';
import { mockToken } from './emulator';

export const provider = new CorpusReasoningProvider();

function user(id: string, role: Actor['role']): Actor {
  return withIdToken({ id, role, authenticated: true, via: 'firebase' }, mockToken(id, { am_role: role }));
}

export const contributor = user('alice', 'research_contributor');
export const editor = user('ed', 'research_editor');
export const auditor = user('ada', 'editorial_admin');
export const anonymous: Actor = { id: null, role: 'public_reader', authenticated: false, via: 'none' };

export async function seedCurated() {
  const r = await runAnalysis({ query: DANIEL_12_1.aliases[0], reference: DANIEL_12_1.reference, passageText: DANIEL_12_1.passageText }, provider);
  return r.analysis!;
}

/** Draft → propose → review → approve → audit, each write under the acting user's token. */
export async function runWorkflow() {
  const a = await seedCurated();
  const claimId = a.claims[0].id;
  await storeFor(contributor).saveDraft({ id: 'draft-1', status: 'draft', createdBy: 'alice', creatorRole: 'research_contributor', analysis: a, createdAt: '2026-10-20T19:00:00Z' });
  await storeFor(contributor).appendAudit({ id: 'audit-draft-1', entityType: 'DRAFT', entityId: 'draft-1', changeType: 'DRAFTED', oldValue: null, newValue: null, reason: 'Draft created.', modelProvider: null, modelVersion: null, promptVersion: null, timestamp: '2026-10-20T19:00:00Z', actorId: 'alice', actorRole: 'research_contributor' });
  const { proposal } = await proposeChallenge(claimId, contributor, { provider });
  await decideProposal(proposal.id, 'approve', editor, 'Reviewed against the cited sources.');
  return { analysis: a, claimId, proposalId: proposal.id };
}
