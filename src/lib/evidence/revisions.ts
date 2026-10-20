/**
 * Editorial workflow for the Evidence Intelligence record (Master Prompt 3, §3).
 *
 * - Anyone may *propose* a challenge. The proposal is stored apart from the
 *   published analysis and changes nothing a reader sees.
 * - Only an authenticated editor may *decide* a proposal, never their own.
 * - Approval applies the revision only if the analysis is still at the version
 *   the proposal was computed against; otherwise it is a conflict.
 * - Rejection leaves the published analysis exactly as it was.
 * - Every step appends an attributable audit record.
 */

import { randomUUID } from 'node:crypto';
import { can } from '@/lib/auth/roles';
import type { Actor } from '@/lib/auth/actor';
import { computeChallenge } from './challenge';
import type { EvidenceReasoningProvider } from './providers/types';
import { ChallengeProposalSchema, type Analysis, type ChallengeProposal, type Claim } from './schema';
import { canPersist, storeFor } from './store';
import type { AuditRecord } from './schema';

export type RevisionErrorCode =
  | 'not_persisted'
  | 'not_found'
  | 'unauthenticated'
  | 'forbidden'
  | 'self_approval'
  | 'invalid_state'
  | 'conflict';

export class RevisionError extends Error {
  constructor(
    readonly code: RevisionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'RevisionError';
  }
}

export const REVISION_ERROR_STATUS: Record<RevisionErrorCode, number> = {
  not_persisted: 503,
  not_found: 404,
  unauthenticated: 401,
  forbidden: 403,
  self_approval: 403,
  invalid_state: 409,
  conflict: 409,
};

export interface ProposalResult {
  proposal: ChallengeProposal;
  /** The published claim, unchanged by the proposal. */
  published: Claim;
  /** True when an identical request (same Idempotency-Key) was already recorded. */
  replayed: boolean;
}

export async function proposeChallenge(
  claimId: string,
  actor: Actor,
  opts: { idempotencyKey?: string | null; provider?: EvidenceReasoningProvider } = {},
): Promise<ProposalResult> {
  if (!can(actor.role, 'proposal.create')) throw new RevisionError('forbidden', 'This role may not submit challenges.');
  if (!canPersist()) throw new RevisionError('not_persisted', 'No durable store is configured.');
  const store = storeFor(actor);
  if (store.requiresIdentity && !actor.authenticated) {
    throw new RevisionError('unauthenticated', 'Sign in to submit a challenge: proposals are recorded under your own account.');
  }

  const key = opts.idempotencyKey ?? null;
  if (key) {
    const existing = await store.findProposalByIdempotencyKey(key);
    if (existing) {
      if (existing.claimId !== claimId) throw new RevisionError('conflict', 'Idempotency-Key was already used for another claim.');
      const found = await store.findClaim(claimId);
      return { proposal: existing, published: found!.analysis.claims[found!.claimIndex], replayed: true };
    }
  }

  const found = await store.findClaim(claimId);
  if (!found) throw new RevisionError('not_found', `No claim found with id "${claimId}".`);
  const { analysis, claimIndex } = found;

  const computed = await computeChallenge(analysis, claimIndex, opts.provider);
  const now = new Date().toISOString();
  const proposal = ChallengeProposalSchema.parse({
    id: randomUUID(),
    claimId,
    analysisId: analysis.id,
    baseVersion: analysis.updatedAt,
    status: 'proposed',
    proposedBy: actor.id,
    proposerRole: actor.role,
    idempotencyKey: key,
    challenge: computed.challenge,
    revisedClaim: computed.updatedClaim,
    decidedBy: null,
    decidedRole: null,
    decidedAt: null,
    decisionReason: null,
    createdAt: now,
  } satisfies ChallengeProposal);

  await store.saveProposal(proposal);
  await store.appendAudit({
    id: randomUUID(),
    entityType: 'PROPOSAL',
    entityId: proposal.id,
    changeType: 'PROPOSED',
    oldValue: { claimId, score: analysis.claims[claimIndex].overallConfidence },
    newValue: { proposedScore: computed.challenge.revisedScore, outcome: computed.challenge.outcome },
    reason: 'Challenge submitted for editorial review. The published assessment is unchanged.',
    modelProvider: computed.modelProvider,
    modelVersion: computed.modelVersion,
    promptVersion: computed.promptVersion,
    timestamp: now,
    actorId: actor.id,
    actorRole: actor.role,
  });

  return { proposal, published: analysis.claims[claimIndex], replayed: false };
}

export interface DecisionResult {
  proposal: ChallengeProposal;
  /** The published analysis after the decision (unchanged on rejection). */
  analysis: Analysis;
}

export async function decideProposal(
  proposalId: string,
  decision: 'approve' | 'reject',
  actor: Actor,
  reason: string,
): Promise<DecisionResult> {
  if (!actor.authenticated || !actor.id) {
    throw new RevisionError('unauthenticated', 'Editorial decisions require a signed-in editor.');
  }
  if (!can(actor.role, 'proposal.decide')) {
    throw new RevisionError('forbidden', 'Only research editors and editorial administrators may decide proposals.');
  }
  if (!canPersist()) throw new RevisionError('not_persisted', 'No durable store is configured.');
  const store = storeFor(actor);

  const proposal = await store.getProposal(proposalId);
  if (!proposal) throw new RevisionError('not_found', `No proposal with id "${proposalId}".`);
  if (proposal.proposedBy && proposal.proposedBy === actor.id) {
    throw new RevisionError('self_approval', 'A proposal cannot be decided by its own author.');
  }
  if (proposal.status !== 'proposed') {
    throw new RevisionError('invalid_state', `Proposal is already ${proposal.status}.`);
  }

  const current = await store.getAnalysis(proposal.analysisId);
  if (!current) throw new RevisionError('not_found', 'The analysis this proposal targets no longer exists.');
  const now = new Date().toISOString();
  const decided = { decidedBy: actor.id, decidedRole: actor.role, decidedAt: now, decisionReason: reason };

  if (decision === 'reject') {
    const audit: AuditRecord = {
      id: randomUUID(),
      entityType: 'PROPOSAL',
      entityId: proposal.id,
      changeType: 'REJECTED',
      oldValue: null,
      newValue: { claimId: proposal.claimId },
      reason,
      modelProvider: null,
      modelVersion: null,
      promptVersion: null,
      timestamp: now,
      actorId: actor.id,
      actorRole: actor.role,
    };
    if (store.commitDecision) {
      const ok = await store.commitDecision({ proposalId: proposal.id, from: 'proposed', patch: { status: 'rejected', ...decided }, audit });
      if (!ok) throw new RevisionError('conflict', 'Proposal was decided concurrently.');
      return { proposal: { ...proposal, status: 'rejected', ...decided }, analysis: current };
    }
    const moved = await store.transitionProposal(proposal.id, 'proposed', { status: 'rejected', ...decided });
    if (!moved) throw new RevisionError('conflict', 'Proposal was decided concurrently.');
    await store.appendAudit({
      id: randomUUID(),
      entityType: 'PROPOSAL',
      entityId: proposal.id,
      changeType: 'REJECTED',
      oldValue: null,
      newValue: { claimId: proposal.claimId },
      reason,
      modelProvider: null,
      modelVersion: null,
      promptVersion: null,
      timestamp: now,
      actorId: actor.id,
      actorRole: actor.role,
    });
    return { proposal: { ...proposal, status: 'rejected', ...decided }, analysis: current };
  }

  // Approve. A stale proposal is never applied over a newer analysis.
  if (current.updatedAt !== proposal.baseVersion) {
    if (store.commitDecision) {
      await store.commitDecision({
        proposalId: proposal.id,
        from: 'proposed',
        patch: { status: 'superseded', ...decided, decisionReason: 'Analysis changed after this proposal was made.' },
        audit: { id: randomUUID(), entityType: 'PROPOSAL', entityId: proposal.id, changeType: 'UPDATED', oldValue: { status: 'proposed' }, newValue: { status: 'superseded' }, reason: 'Analysis changed after this proposal was made.', modelProvider: null, modelVersion: null, promptVersion: null, timestamp: now, actorId: actor.id, actorRole: actor.role },
      });
      throw new RevisionError('conflict', 'The analysis changed after this proposal was made; it must be re-proposed.');
    }
    await store.transitionProposal(proposal.id, 'proposed', { status: 'superseded', ...decided, decisionReason: 'Analysis changed after this proposal was made.' });
    throw new RevisionError('conflict', 'The analysis changed after this proposal was made; it must be re-proposed.');
  }

  const claimIndex = current.claims.findIndex((c) => c.id === proposal.claimId);
  if (claimIndex === -1) throw new RevisionError('not_found', 'The claim this proposal targets no longer exists.');
  const previous = current.claims[claimIndex];
  // Strictly later than the base, so the version token always moves.
  const nextVersion = new Date(Math.max(Date.parse(now), Date.parse(current.updatedAt) + 1)).toISOString();
  const updated: Analysis = {
    ...current,
    claims: current.claims.map((c, i) => (i === claimIndex ? proposal.revisedClaim : c)),
    updatedAt: nextVersion,
  };

  const approvalAudit = (): AuditRecord => ({
    id: randomUUID(),
    entityType: 'CLAIM',
    entityId: proposal.claimId,
    changeType: 'APPROVED',
    oldValue: { score: previous.overallConfidence, label: previous.confidenceLabel, version: proposal.baseVersion },
    newValue: {
      score: proposal.revisedClaim.overallConfidence,
      label: proposal.revisedClaim.confidenceLabel,
      version: nextVersion,
      proposalId: proposal.id,
      proposedBy: proposal.proposedBy,
    },
    reason,
    modelProvider: proposal.challenge.modelProvider,
    modelVersion: proposal.challenge.modelVersion,
    promptVersion: null,
    timestamp: now,
    actorId: actor.id,
    actorRole: actor.role,
  });

  if (store.commitDecision) {
    const ok = await store.commitDecision({
      proposalId: proposal.id,
      from: 'proposed',
      patch: { status: 'approved', ...decided },
      audit: approvalAudit(),
      analysis: { next: updated, expectedUpdatedAt: proposal.baseVersion },
      challenge: proposal.challenge,
    });
    if (!ok) throw new RevisionError('conflict', 'The proposal or the analysis changed while the decision was being applied; nothing was written.');
    return { proposal: { ...proposal, status: 'approved', ...decided }, analysis: updated };
  }

  const moved = await store.transitionProposal(proposal.id, 'proposed', { status: 'approved', ...decided });
  if (!moved) throw new RevisionError('conflict', 'Proposal was decided concurrently.');

  const replaced = await store.replaceAnalysisIfVersion(updated, proposal.baseVersion);
  if (!replaced) {
    await store.transitionProposal(proposal.id, 'approved', { status: 'superseded', ...decided, decisionReason: 'Analysis changed while the decision was being applied.' });
    throw new RevisionError('conflict', 'The analysis changed while the decision was being applied; nothing was overwritten.');
  }

  await store.saveChallenge(proposal.challenge);
  await store.appendAudit(approvalAudit());

  return { proposal: { ...proposal, status: 'approved', ...decided }, analysis: updated };
}
