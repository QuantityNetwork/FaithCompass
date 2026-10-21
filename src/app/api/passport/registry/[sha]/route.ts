import { NextResponse } from 'next/server';
import { verifyPassportInput } from '@/lib/passport/verify-service';

export const dynamic = 'force-dynamic';

/** Registry and revocation status of one passport hash (public; content is not checked without the bundle). */
export async function GET(_request: Request, { params }: { params: Promise<{ sha: string }> }) {
  const { sha } = await params;
  if (!/^[0-9a-f]{64}$/.test(sha)) return NextResponse.json({ error: 'Not a SHA-256.', code: 'INVALID_REQUEST' }, { status: 400 });
  const r = await verifyPassportInput({ sha256: sha });
  return NextResponse.json({ sha256: sha, verdict: r.verdict, summary: r.summary, registry: r.registry, revocation: r.revocation, key: r.key }, { headers: { 'cache-control': 'public, max-age=60' } });
}
