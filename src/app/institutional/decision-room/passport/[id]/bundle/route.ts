import { NextResponse } from 'next/server';
import { PassportIdError } from '@/lib/decision/passport';
import { buildBundle, bundleFileName } from '@/lib/passport-bundle/bundle';

/** Download the portable bundle; ?redacted=1 omits the source documents. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const redacted = new URL(req.url).searchParams.get('redacted') === '1';
  try {
    const b = buildBundle(decodeURIComponent(id), { redacted });
    return new NextResponse(JSON.stringify(b, null, 2), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': `attachment; filename="${bundleFileName(b)}"`,
        'cache-control': 'public, max-age=3600',
      },
    });
  } catch (err) {
    if (err instanceof PassportIdError) return NextResponse.json({ error: err.message }, { status: 404 });
    throw err;
  }
}
