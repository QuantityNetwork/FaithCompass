import { handle, json } from '@/lib/workspace/http';

export const dynamic = 'force-dynamic';

/** The signed-in user and the workspaces their token grants (custom claim `am_tenants`). */
export async function GET(request: Request) {
  return handle(request, 'workspace.whoami', async ({ actor }) =>
    json({ user: { uid: actor.uid, email: actor.email }, workspaces: Object.entries(actor.tenants).map(([id, role]) => ({ id, role })) }),
  );
}
