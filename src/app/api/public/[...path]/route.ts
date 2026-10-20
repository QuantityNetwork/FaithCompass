import { dispatchLegacy } from '@/lib/api/legacy';
import { headFromGet } from '@/lib/api/http';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ path: string[] }> };

async function handle(request: Request, { params }: Params) {
  const { path } = await params;
  return dispatchLegacy(request, path.join('/'));
}

export const GET = handle;
export const HEAD = headFromGet(handle);
export const POST = handle;
export const OPTIONS = handle;
