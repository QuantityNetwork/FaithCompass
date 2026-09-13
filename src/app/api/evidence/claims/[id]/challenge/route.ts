import { NextResponse } from 'next/server';
import { ensureSeeded } from '@/lib/evidence/bootstrap';
import { challengeClaim } from '@/lib/evidence/challenge';
import { StructuredOutputError } from '@/lib/evidence/schema';

export const dynamic = 'force-dynamic';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await ensureSeeded();

  try {
    const outcome = await challengeClaim(id);
    if (!outcome) {
      return NextResponse.json({ error: `No claim found with id "${id}".` }, { status: 404 });
    }
    return NextResponse.json({
      challenge: outcome.challenge,
      claim: {
        id: outcome.updatedClaim.id,
        overallConfidence: outcome.updatedClaim.overallConfidence,
        confidenceLabel: outcome.updatedClaim.confidenceLabel,
        certainty: outcome.updatedClaim.certainty,
      },
    });
  } catch (err) {
    if (err instanceof StructuredOutputError) {
      return NextResponse.json({ error: err.message, stage: err.stage }, { status: 502 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Challenge failed.' },
      { status: 500 },
    );
  }
}
