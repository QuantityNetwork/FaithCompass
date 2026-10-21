import { z } from 'zod';
import { handle, json } from '@/lib/workspace/http';
import { MAX_IMPORT_BYTES, parseImport } from '@/lib/workspace/model';
import { documentSummary, importDocument, listDocuments } from '@/lib/workspace/store';

export const dynamic = 'force-dynamic';
type P = { params: Promise<{ t: string }> };

const ImportSchema = z
  .object({
    filename: z.string().min(1).max(200),
    title: z.string().max(200).optional(),
    contentBase64: z.string().min(1).max(Math.ceil((MAX_IMPORT_BYTES * 4) / 3) + 8),
  })
  .strict();

export async function GET(request: Request, { params }: P) {
  const { t } = await params;
  return handle(request, 'workspace.documents.list', async ({ actor }) => json({ documents: (await listDocuments(actor, t)).map(documentSummary) }));
}

/** Import a document: the file bytes (base64) are hashed as received, then normalised and split into passages. */
export async function POST(request: Request, { params }: P) {
  const { t } = await params;
  return handle(
    request,
    'workspace.documents.import',
    async ({ actor, body }) => {
      const input = ImportSchema.parse(body);
      const parsed = parseImport({ filename: input.filename, title: input.title, bytes: new Uint8Array(Buffer.from(input.contentBase64, 'base64')) });
      const doc = await importDocument(actor, t, parsed);
      return json({ document: documentSummary(doc) }, 201);
    },
    { write: true, maxBytes: Math.ceil((MAX_IMPORT_BYTES * 4) / 3) + 2_048, perMinute: 20 },
  );
}
