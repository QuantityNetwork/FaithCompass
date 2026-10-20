import { headFromGet } from '@/lib/api/http';
import { bundleHandler } from '@/lib/decision/api';

export const dynamic = 'force-dynamic';
export const GET = (request: Request) => bundleHandler(request);
export const HEAD = headFromGet(GET);
export const OPTIONS = GET;
