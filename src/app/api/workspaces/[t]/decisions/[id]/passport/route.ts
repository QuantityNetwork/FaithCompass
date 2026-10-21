import { z } from 'zod';
import { handle, json } from '@/lib/workspace/http';
import { workspaceBundleFileName } from '@/lib/workspace/passport';
import { exportDecision } from '@/lib/workspace/store';

export const dynamic = 'force-dynamic';

const ExportSchema = z.object({ redacted: z.boolean().default(false) }).strict();

/**
 * Export the decision as a Decision Passport bundle (schema 1.0.0) for offline verification. POST, because every
 * export is written to the workspace audit log and the passport hash is recorded.
 */
export async function POST(request: Request, { params }: { params: Promise<{ t: string; id: string }> }) {
  const { t, id } = await params;
  return handle(
    request,
    'workspace.decisions.export',
    async ({ actor, body }) => {
      const { redacted } = ExportSchema.parse(body ?? {});
      const { bundle, firstExport } = await exportDecision(actor, t, id, { redacted });
      return json(bundle, 200, {
        'content-disposition': `attachment; filename="${workspaceBundleFileName(bundle)}"`,
        'x-passport-sha256': bundle.integrity.passport_sha256,
        'x-first-export': String(firstExport),
      });
    },
    { tenant: t, write: true, maxBytes: 256, perMinute: 20 },
  );
}
