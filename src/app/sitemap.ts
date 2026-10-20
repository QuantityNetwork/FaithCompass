import type { MetadataRoute } from 'next';
import { getRecord } from '@/lib/record/record';
import { absoluteUrl } from '@/lib/site/config';

// Rendered per request so URLs always use the configured canonical origin.
export const dynamic = 'force-dynamic';

/** Every public research record has a stable, indexable URL. */
export default function sitemap(): MetadataRoute.Sitemap {
  const record = getRecord();
  const latest = (dates: string[]) => dates.sort().at(-1);
  const pages = [
    '/',
    '/research',
    '/claims',
    '/covenants',
    '/doctrine',
    '/traditions',
    '/compare',
    '/hermeneutics',
    '/corpus',
    '/methodology',
    '/system',
    '/about',
    '/institutional',
    '/institutional/decision-twin',
    '/institutional/decision-room',
    '/changelog',
    '/developers',
    '/evidence',
    '/evidence/method',
    '/privacy',
    '/terms',
  ].map((path) => ({ url: absoluteUrl(path), changeFrequency: 'weekly' as const, priority: path === '/' ? 1 : 0.7 }));

  return [
    ...pages,
    ...record.data.cases.map((c) => ({
      url: absoluteUrl(`/research/${c.slug}`),
      lastModified: latest(record.claimsInCase(c.slug).flatMap((x) => x.revisions.map((r) => r.publishedAt))),
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    })),
    ...record.data.claims.map((c) => ({
      url: absoluteUrl(`/claims/${c.code}`),
      lastModified: record.current(c).publishedAt,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    ...record.data.traditions.map((t) => ({ url: absoluteUrl(`/traditions/${t.id}`), changeFrequency: 'monthly' as const, priority: 0.6 })),
  ];
}
