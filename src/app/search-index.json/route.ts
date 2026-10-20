import { buildSearchIndex } from '@/lib/site/search-index';

// Built once per deployment from the record compiled into it.
export const dynamic = 'force-static';

export function GET() {
  return Response.json(buildSearchIndex(), {
    headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400' },
  });
}
