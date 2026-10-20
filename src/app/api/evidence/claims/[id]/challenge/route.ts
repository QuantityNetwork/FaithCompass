import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ensureSeeded } from '@/lib/evidence/bootstrap';
import { proposeChallenge, RevisionError, REVISION_ERROR_STATUS } from '@/lib/evidence/revisions';
import { canPersist, NOT_PERSISTED_MESSAGE } from '@/lib/evidence/store';
import { StructuredOutputError } from '@/lib/evidence/schema';
import { guardWrite } from '@/lib/security/write-guard';
import { securityEvent } from '@/lib/security/audit-log';

export const dynamic = 'force-dynamic';

/**
 * Submit a challenge to a published claim.
 *
 * The challenge is recorded as a *proposal* for editorial review. It never
 * changes the published score: that happens only when an editor other than the
 * proposer approves it (POST /api/evidence/proposals/{id}/decision).
 */

// Strict: unknown fields (a "role", an "approved" flag) are rejected, not ignored.
const BodySchema = z.object({ note: z.string().max(2000).optional() }).strict();
const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{8,128}$/;
const CLAIM_ID = /^[A-Za-z0-9._:-]{1,200}$/;

const noStore = { 'cache-control': 'no-store' };

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await guardWrite(request, { permission: 'proposal.create', action: 'challenge.propose', maxBytes: 4096 });
  if (!gate.ok) return gate.response;

  const { id } = await params;
  if (!CLAIM_ID.test(id)) return NextResponse.json({ error: 'Invalid claim id.' }, { status: 400, headers: noStore });
  const parsed = BodySchema.safeParse(gate.body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request.', issues: parsed.error.issues }, { status: 400, headers: noStore });
  }
  const key = request.headers.get('idempotency-key');
  if (key !== null && !IDEMPOTENCY_KEY.test(key)) {
    return NextResponse.json({ error: 'Idempotency-Key must be 8-128 characters of [A-Za-z0-9_-].' }, { status: 400, headers: noStore });
  }

  if (!canPersist()) {
    return NextResponse.json(
      { error: NOT_PERSISTED_MESSAGE, persisted: false, publishedChanged: false },
      { status: 503, headers: noStore },
    );
  }

  await ensureSeeded();
  try {
    const { proposal, published, replayed } = await proposeChallenge(id, gate.actor, { idempotencyKey: key });
    securityEvent({ action: 'challenge.propose', outcome: 'allowed', status: 202, reason: replayed ? 'replayed' : 'proposal_created', actorRole: gate.actor.role, actorId: gate.actor.id, client: gate.client, requestId: gate.requestId, entityId: proposal.id });
    return NextResponse.json(
      {
        persisted: true,
        publishedChanged: false,
        message: 'Your challenge was recorded as a proposal for editorial review. The published assessment is unchanged until an editor approves it.',
        proposal: {
          id: proposal.id,
          status: proposal.status,
          claimId: proposal.claimId,
          proposedScore: proposal.challenge.revisedScore,
          proposedLabel: proposal.challenge.revisedLabel,
          outcome: proposal.challenge.outcome,
          createdAt: proposal.createdAt,
        },
        published: {
          id: published.id,
          overallConfidence: published.overallConfidence,
          confidenceLabel: published.confidenceLabel,
        },
      },
      { status: replayed ? 200 : 202, headers: noStore },
    );
  } catch (err) {
    if (err instanceof RevisionError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: REVISION_ERROR_STATUS[err.code], headers: noStore });
    }
    if (err instanceof StructuredOutputError) {
      return NextResponse.json({ error: err.message, stage: err.stage }, { status: 502, headers: noStore });
    }
    securityEvent({ action: 'challenge.propose', outcome: 'error', status: 500, reason: 'exception', actorRole: gate.actor.role, actorId: gate.actor.id, client: gate.client, requestId: gate.requestId });
    return NextResponse.json({ error: 'Challenge failed.', requestId: gate.requestId }, { status: 500, headers: noStore });
  }
}
