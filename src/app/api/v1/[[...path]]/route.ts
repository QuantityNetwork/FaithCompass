import { dispatchV1 } from '@/lib/api/v1';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ path?: string[] }> };

async function handle(request: Request, { params }: Params) {
  const { path } = await params;
  return dispatchV1(request, (path ?? []).join('/'));
}

export const GET = handle;
export const POST = handle;
export const OPTIONS = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
