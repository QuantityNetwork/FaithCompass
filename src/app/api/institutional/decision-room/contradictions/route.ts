import { headFromGet } from '@/lib/api/http';
import { contradictionsHandler } from '@/lib/decision/api';

export const dynamic = 'force-dynamic';
export const GET = (request: Request) => contradictionsHandler(request);
export const HEAD = headFromGet(GET);
export const OPTIONS = GET;
