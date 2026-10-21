import { handle, json } from '@/lib/workspace/http';
import { CreateDraftSchema, createDraft, draftSummary, listDrafts } from '@/lib/passport/store';

export const dynamic = 'force-dynamic';

/** Passport drafts of a workspace (members only). */
export async function GET(request: Request, { params }: { params: Promise<{ t: string }> }) {
  const { t } = await params;
  return handle(request, 'workspace.passports.list', async ({ actor }) => json({ drafts: (await listDrafts(actor, t)).map(draftSummary) }), { tenant: t });
}

/** Create a passport draft from a Deep Analysis bundle (re-verified on the server; the document text is not stored). */
export async function POST(request: Request, { params }: { params: Promise<{ t: string }> }) {
  const { t } = await params;
  return handle(
    request,
    'workspace.passports.draft',
    async ({ actor, body }) => json({ draft: draftSummary(await createDraft(actor, t, CreateDraftSchema.parse(body))) }, 201),
    { tenant: t, write: true, maxBytes: 4_000_000, perMinute: 6 },
  );
}
