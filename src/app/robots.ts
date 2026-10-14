import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/site/config';

// Rendered per request so URLs always use the configured canonical origin.
export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Machine endpoints and per-simulation explorer states are not search results.
        disallow: ['/api/', '/mcp', '/claims/*/report'],
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
