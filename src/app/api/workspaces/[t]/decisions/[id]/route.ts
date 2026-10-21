import { handle, json } from '@/lib/workspace/http';
import { getDecision } from '@/lib/workspace/store';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ t: string; id: string }> }) {
  const { t, id } = await params;
  return handle(request, 'workspace.decisions.get', async ({ actor }) => json({ decision: (await getDecision(actor, t, id)).decision }));
}
