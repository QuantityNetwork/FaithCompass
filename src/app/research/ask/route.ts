/**
 * POST /research/ask — the question bar's target.
 *
 * The question travels in the request body, so it is not written to request logs or
 * browser history as part of an address. The response is a 303 to the address the
 * question should be read at: a published case or dossier, or the question's search
 * terms only (see resolveQuestion). A GET here, e.g. from an old link, goes to /research.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { resolveQuestion } from '@/lib/research/dossier';
import { getRecord } from '@/lib/record/record';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let q = '';
  try {
    const form = await req.formData();
    q = String(form.get('q') ?? '').trim().slice(0, 500);
  } catch {
    q = '';
  }
  const to = new URL('/research', req.url);
  if (q) {
    const res = resolveQuestion(getRecord(), q);
    if (res.kind === 'case') to.searchParams.set('case', res.slug);
    else if (res.kind === 'dossier') to.searchParams.set('dossier', res.id);
    else to.searchParams.set('q', res.keywords);
  }
  return NextResponse.redirect(to, { status: 303, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
}

export function GET(req: NextRequest) {
  return NextResponse.redirect(new URL('/research', req.url), 307);
}
