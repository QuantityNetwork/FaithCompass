import { z } from 'zod';
import { handle, json } from '@/lib/workspace/http';
import { IssueSchema, ReviewSchema, RevokeSchema, SubmitSchema, draftSummary, getDraft, issueDraft, reviewDraft, revokeDraft, submitDraft } from '@/lib/passport/store';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ t: string; id: string }> }) {
  const { t, id } = await params;
  return handle(request, 'workspace.passports.get', async ({ actor }) => json({ draft: draftSummary((await getDraft(actor, t, id)).draft) }), { tenant: t });
}

const Action = z.object({ action: z.enum(['submit', 'approve', 'reject', 'issue', 'revoke']) }).passthrough();

/** One lifecycle step: submit (proposer), approve/reject (another editor), issue (server-signed), revoke (editor). */
export async function POST(request: Request, { params }: { params: Promise<{ t: string; id: string }> }) {
  const { t, id } = await params;
  return handle(
    request,
    'workspace.passports.step',
    async ({ actor, body }) => {
      const { action } = Action.parse(body);
      if (action === 'submit') {
        SubmitSchema.parse(body);
        return json({ draft: draftSummary(await submitDraft(actor, t, id)) });
      }
      if (action === 'approve' || action === 'reject') return json({ draft: draftSummary(await reviewDraft(actor, t, id, ReviewSchema.parse(body))) });
      if (action === 'issue') {
        IssueSchema.parse(body);
        const { draft, bundle } = await issueDraft(actor, t, id);
        return json({ draft: draftSummary(draft), passport_sha256: bundle.integrity.passport_sha256, passport_id: bundle.passport_id });
      }
      return json({ draft: draftSummary(await revokeDraft(actor, t, id, RevokeSchema.parse(body))) });
    },
    { tenant: t, write: true, maxBytes: 4096, perMinute: 20 },
  );
}
