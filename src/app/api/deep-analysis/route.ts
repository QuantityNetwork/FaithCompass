import { NextResponse } from 'next/server';
import { z } from 'zod';
import { openAiProvider } from '@/lib/deep-analysis/ai';
import { aiAccess } from '@/lib/deep-analysis/access';
import { analyzeDocument } from '@/lib/deep-analysis/analyze';
import { buildDeepBundle } from '@/lib/deep-analysis/bundle';
import { MAX_UPLOAD_BYTES, ParseError, parseDocument } from '@/lib/deep-analysis/parse';
import { logServerError } from '@/lib/security/audit-log';
import { guardWrite } from '@/lib/security/write-guard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 180;

const noStore = { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' };
const Body = z.object({
  filename: z.string().min(1).max(200),
  contentBase64: z.string().min(1).max(Math.ceil((MAX_UPLOAD_BYTES * 4) / 3) + 8),
  sample: z.boolean().optional(),
  useAi: z.boolean().optional(),
});

/**
 * Analyse one uploaded document in memory. Nothing is stored: the file, its text and the report exist only for this
 * request and in the caller's browser. The AI layer runs only when configured and permitted (lib/deep-analysis/access).
 */
export async function POST(request: Request) {
  const gate = await guardWrite(request, { permission: 'draft.create', action: 'deep_analysis', maxBytes: Math.ceil((MAX_UPLOAD_BYTES * 4) / 3) + 4096, perMinute: 10, perDay: 1000 });
  if (!gate.ok) return gate.response;
  const parsed = Body.safeParse(gate.body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request.', code: 'INVALID_REQUEST' }, { status: 400, headers: noStore });
  try {
    const bytes = new Uint8Array(Buffer.from(parsed.data.contentBase64, 'base64'));
    const doc = await parseDocument(parsed.data.filename, bytes);
    const provider = openAiProvider();
    const blocked = provider.configured && parsed.data.useAi !== false ? await aiAccess(request, gate.client) : provider.configured ? 'AI layer switched off for this run.' : null;
    const report = await analyzeDocument(doc, { provider, aiBlockedReason: blocked, sample: !!parsed.data.sample });
    return NextResponse.json({ report, bundle: buildDeepBundle(report), stored: false }, { headers: noStore });
  } catch (e) {
    if (e instanceof ParseError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status, headers: noStore });
    logServerError('deep_analysis', e);
    return NextResponse.json({ error: 'The analysis failed.', code: 'FAILED', requestId: gate.requestId }, { status: 500, headers: noStore });
  }
}

/** What this deployment offers, for the page to show before an upload. */
export async function GET() {
  const p = openAiProvider();
  return NextResponse.json(
    { ai: { configured: p.configured, model: p.configured ? p.model : null, access: process.env.VERCEL_ENV === 'preview' && process.env.DEEP_ANALYSIS_AI_ACCESS === 'deployment-protected' ? 'deployment-protected' : process.env.VERCEL_ENV ? 'signed-in' : 'local' }, maxBytes: MAX_UPLOAD_BYTES, stored: false },
    { headers: noStore },
  );
}
