import { headFromGet } from '@/lib/api/http';
import { scenarioHandler } from '@/lib/decision/api';

export const dynamic = 'force-dynamic';
export const GET = (request: Request) => scenarioHandler(request);
export const HEAD = headFromGet(GET);
export const OPTIONS = GET;
