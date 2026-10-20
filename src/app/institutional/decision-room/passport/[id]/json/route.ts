import { NextResponse } from 'next/server';
import { PassportIdError, buildPassport } from '@/lib/decision/passport';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const p = buildPassport(decodeURIComponent(id));
    return new NextResponse(JSON.stringify(p, null, 2), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': `attachment; filename="decision-passport-${p.integrity.sha256.slice(0, 12)}.json"`,
        'cache-control': 'public, max-age=3600, immutable',
      },
    });
  } catch (err) {
    if (err instanceof PassportIdError) return NextResponse.json({ error: err.message }, { status: 404 });
    throw err;
  }
}
