import { NextResponse } from 'next/server';
import { PassportIdError, buildPassport, passportMarkdown } from '@/lib/decision/passport';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const p = buildPassport(decodeURIComponent(id));
    return new NextResponse(passportMarkdown(p), {
      headers: {
        'content-type': 'text/markdown; charset=utf-8',
        'content-disposition': `attachment; filename="decision-passport-${p.integrity.sha256.slice(0, 12)}.md"`,
        'cache-control': 'public, max-age=3600, immutable',
      },
    });
  } catch (err) {
    if (err instanceof PassportIdError) return NextResponse.json({ error: err.message }, { status: 404 });
    throw err;
  }
}
