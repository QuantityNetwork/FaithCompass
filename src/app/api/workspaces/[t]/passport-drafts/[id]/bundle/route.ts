import { handle, json } from '@/lib/workspace/http';
import { daBundleFileName } from '@/lib/passport/bundle';
import { draftBundle } from '@/lib/passport/store';

export const dynamic = 'force-dynamic';

/** The passport bundle: unsigned and labelled DRAFT before issue; the issued, signed passport afterwards. */
export async function GET(request: Request, { params }: { params: Promise<{ t: string; id: string }> }) {
  const { t, id } = await params;
  return handle(
    request,
    'workspace.passports.bundle',
    async ({ actor }) => {
      const b = await draftBundle(actor, t, id);
      return json(b, 200, { 'content-disposition': `attachment; filename="${daBundleFileName(b)}"`, 'x-passport-sha256': b.integrity.passport_sha256 });
    },
    { tenant: t, perMinute: 30 },
  );
}
