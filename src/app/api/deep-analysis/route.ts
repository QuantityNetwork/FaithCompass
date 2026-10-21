import { NextResponse } from 'next/server';
import { z } from 'zod';
import { openAiProvider } from '@/lib/deep-analysis/ai';
import { aiAccess, aiAccessMode, aiIdentity, aiRemaining, aiUserDailyLimit } from '@/lib/deep-analysis/access';
import { analyzeDocument } from '@/lib/deep-analysis/analyze';
import { buildDeepBundle } from '@/lib/deep-analysis/bundle';
import { MAX_FILE_BYTES, MAX_TEXT_CHARS, MAX_UPLOAD_BYTES, ParseError, documentFromText, parseDocument } from '@/lib/deep-analysis/parse';
import { logServerError } from '@/lib/security/audit-log';
import { guardWrite } from '@/lib/security/write-guard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/** Vercel Pro with Fluid compute allows up to 800 s; a high-effort reasoning run on a long document can take minutes. */
export const maxDuration = 800;

const noStore = { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' };
const Body = z.union([
  z.object({
    filename: z.string().min(1).max(200),
    contentBase64: z.string().min(1).max(Math.ceil((MAX_UPLOAD_BYTES * 4) / 3) + 8),
    sample: z.boolean().optional(),
    useAi: z.boolean().optional(),
  }),
  // Files over MAX_UPLOAD_BYTES: read in the browser, only the text is sent (the file never reaches the server).
  z.object({
    filename: z.string().min(1).max(200),
    extracted: z.object({
      format: z.enum(['pdf', 'docx', 'txt', 'md']),
      text: z.string().min(1).max(MAX_TEXT_CHARS * 2),
      pages: z.number().int().positive().max(100_000).nullable(),
      bytes: z.number().int().positive().max(MAX_FILE_BYTES),
      bytesSha256: z.string().regex(/^[0-9a-f]{64}$/),
    }),
    sample: z.boolean().optional(),
    useAi: z.boolean().optional(),
  }),
]);

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
    const provider = openAiProvider();
    const wantsAi = provider.configured && parsed.data.useAi !== false;
    // Identity first (401/403 before any parsing or AI spend); limits only after the document parses.
    if (wantsAi) {
      const who = await aiIdentity(request);
      if (!who.ok && who.status) return NextResponse.json({ error: who.message, code: who.code }, { status: who.status, headers: noStore });
    }
    const doc =
      'extracted' in parsed.data
        ? documentFromText({ filename: parsed.data.filename, ...parsed.data.extracted })
        : await parseDocument(parsed.data.filename, new Uint8Array(Buffer.from(parsed.data.contentBase64, 'base64')));
    let blocked: string | null = provider.configured ? 'AI layer switched off for this run.' : null;
    if (wantsAi) {
      const decision = await aiAccess(request, gate.client);
      if (!decision.ok && decision.status) return NextResponse.json({ error: decision.message, code: decision.code }, { status: decision.status, headers: noStore });
      blocked = decision.ok ? null : decision.message;
    }
    const report = await analyzeDocument(doc, { provider, aiBlockedReason: blocked, sample: !!parsed.data.sample });
    return NextResponse.json({ report, bundle: buildDeepBundle(report), stored: false }, { headers: noStore });
  } catch (e) {
    if (e instanceof ParseError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status, headers: noStore });
    logServerError('deep_analysis', e);
    return NextResponse.json({ error: 'The analysis failed.', code: 'FAILED', requestId: gate.requestId }, { status: 500, headers: noStore });
  }
}

/**
 * What this deployment offers, for the page to show before an upload. With the caller's ID token it also says whether
 * this account may use the AI layer (never who else may).
 */
export async function GET(request: Request) {
  const p = openAiProvider();
  const access = aiAccessMode();
  let viewer: { state: 'signed-out' | 'eligible' | 'email-not-verified' | 'invalid'; remainingToday?: number } = { state: 'signed-out' };
  if (access === 'signed-in' && request.headers.get('authorization')) {
    const who = await aiIdentity(request);
    viewer = who.ok
      ? { state: 'eligible', remainingToday: aiRemaining(who.uid) }
      : { state: who.code === 'EMAIL_NOT_VERIFIED' ? 'email-not-verified' : 'invalid' };
  }
  return NextResponse.json(
    { ai: { configured: p.configured, model: p.configured ? p.model : null, access, perUserDailyLimit: aiUserDailyLimit() }, viewer, maxBytes: MAX_FILE_BYTES, maxDirectBytes: MAX_UPLOAD_BYTES, stored: false },
    { headers: noStore },
  );
}
