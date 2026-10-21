import { handle, json } from '@/lib/workspace/http';
import { DecideSchema } from '@/lib/workspace/model';
import { decide } from '@/lib/workspace/store';

export const dynamic = 'force-dynamic';

/** Approve or reject: a workspace editor who is not the proposer (two-person rule; enforced by the rules as well). */
export async function POST(request: Request, { params }: { params: Promise<{ t: string; id: string }> }) {
  const { t, id } = await params;
  return handle(request, 'workspace.decisions.decide', async ({ actor, body }) => json({ decision: await decide(actor, t, id, DecideSchema.parse(body)) }), { write: true, maxBytes: 4_096 });
}
