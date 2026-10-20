import { headFromGet } from '@/lib/api/http';
import { caseHandler } from '@/lib/decision/api';

export const dynamic = 'force-dynamic';
export const GET = (request: Request) => caseHandler(request);
export const HEAD = headFromGet(GET);
export const OPTIONS = GET;
