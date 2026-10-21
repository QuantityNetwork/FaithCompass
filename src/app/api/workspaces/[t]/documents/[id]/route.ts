import { handle, json } from '@/lib/workspace/http';
import { getDocument } from '@/lib/workspace/store';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ t: string; id: string }> }) {
  const { t, id } = await params;
  return handle(request, 'workspace.documents.get', async ({ actor }) => json({ document: await getDocument(actor, t, id) }));
}
