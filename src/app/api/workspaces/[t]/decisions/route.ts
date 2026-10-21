import { handle, json } from '@/lib/workspace/http';
import { ProposeSchema } from '@/lib/workspace/model';
import { listDecisions, proposeDecision } from '@/lib/workspace/store';

export const dynamic = 'force-dynamic';
type P = { params: Promise<{ t: string }> };

export async function GET(request: Request, { params }: P) {
  const { t } = await params;
  return handle(request, 'workspace.decisions.list', async ({ actor }) => json({ decisions: await listDecisions(actor, t) }));
}

/** Propose a decision citing passages of imported documents. It waits for a second person's review. */
export async function POST(request: Request, { params }: P) {
  const { t } = await params;
  return handle(request, 'workspace.decisions.propose', async ({ actor, body }) => json({ decision: await proposeDecision(actor, t, ProposeSchema.parse(body)) }, 201), {
    write: true,
    maxBytes: 32_768,
  });
}
