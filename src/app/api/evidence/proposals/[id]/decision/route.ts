import { NextResponse } from 'next/server';
import { DecisionBodySchema } from '@/lib/evidence/write-api';
import { decideProposal, RevisionError, REVISION_ERROR_STATUS } from '@/lib/evidence/revisions';
import { guardWrite } from '@/lib/security/write-guard';
import { securityEvent } from '@/lib/security/audit-log';

export const dynamic = 'force-dynamic';

/**
 * Approve or reject a challenge proposal. Editors only, never on their own
 * proposal. With no identity provider configured every caller is an anonymous
 * reader, so this always answers 401: there is no simulated login.
 */
const noStore = { 'cache-control': 'no-store' };

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await guardWrite(request, { permission: 'proposal.decide', action: 'proposal.decide', maxBytes: 4096, perMinute: 30 });
  if (!gate.ok) return gate.response;

  const parsed = DecisionBodySchema.safeParse(gate.body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request.', issues: parsed.error.issues }, { status: 400, headers: noStore });
  }
  const { id } = await params;
  try {
    const { proposal, analysis } = await decideProposal(id, parsed.data.decision, gate.actor, parsed.data.reason);
    securityEvent({ action: 'proposal.decide', outcome: 'allowed', status: 200, reason: proposal.status, actorRole: gate.actor.role, actorId: gate.actor.id, client: gate.client, requestId: gate.requestId, entityId: proposal.id });
    return NextResponse.json({ proposal: { id: proposal.id, status: proposal.status, decidedAt: proposal.decidedAt }, analysisVersion: analysis.updatedAt }, { headers: noStore });
  } catch (err) {
    if (err instanceof RevisionError) {
      securityEvent({ action: 'proposal.decide', outcome: 'denied', status: REVISION_ERROR_STATUS[err.code], reason: err.code, actorRole: gate.actor.role, actorId: gate.actor.id, client: gate.client, requestId: gate.requestId, entityId: id });
      return NextResponse.json({ error: err.message, code: err.code }, { status: REVISION_ERROR_STATUS[err.code], headers: noStore });
    }
    return NextResponse.json({ error: 'Decision failed.', requestId: gate.requestId }, { status: 500, headers: noStore });
  }
}
