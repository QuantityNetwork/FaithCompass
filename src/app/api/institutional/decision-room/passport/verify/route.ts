import { headFromGet } from '@/lib/api/http';
import { verifyHandler } from '@/lib/decision/api';

export const dynamic = 'force-dynamic';
export const GET = (request: Request) => verifyHandler(request);
export const HEAD = headFromGet(GET);
export const OPTIONS = GET;
