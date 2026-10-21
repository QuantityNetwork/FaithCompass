import { handle, json } from '@/lib/workspace/http';
import { listAudit, listPassports } from '@/lib/workspace/store';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ t: string }> }) {
  const { t } = await params;
  return handle(request, 'workspace.audit', async ({ actor }) => {
    const [events, passports] = await Promise.all([listAudit(actor, t), listPassports(actor, t)]);
    return json({ events, passports });
  });
}
