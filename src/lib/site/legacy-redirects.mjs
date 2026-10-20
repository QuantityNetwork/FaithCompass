/**
 * Host-based redirects from previous canonical hosts to the canonical origin, for next.config.mjs.
 *
 * Off unless ABRAHAMMOSES_REDIRECT_LEGACY_HOSTS=1, so merging this changes nothing: the redirects
 * are switched on deliberately at cutover, once the new domain serves this app. When on, every page
 * on a host in ABRAHAMMOSES_LEGACY_ORIGINS answers 308 to the same path on ABRAHAMMOSES_PUBLIC_ORIGIN
 * (Next.js carries the query string over). Machine endpoints are deliberately NOT redirected, since
 * MCP and HTTP clients do not reliably follow a redirect on POST: /api/* (REST v1 and the legacy
 * /api/public/*) and /mcp keep answering on the old host. /_next/* static assets are left alone too.
 *
 * Plain JavaScript because next.config.mjs imports it; tests/legacy-redirects.test.ts covers it.
 *
 * @param {Record<string, string | undefined>} env
 * @returns {Array<{ source: string; has: Array<{ type: 'host'; value: string }>; destination: string; permanent: boolean }>}
 */
export function legacyHostRedirects(env = process.env) {
  if (env.ABRAHAMMOSES_REDIRECT_LEGACY_HOSTS !== '1') return [];
  const canonical = (env.ABRAHAMMOSES_PUBLIC_ORIGIN ?? '').trim().replace(/\/+$/, '');
  if (!/^https:\/\/[^/\s]+$/.test(canonical)) return [];
  const canonicalHost = new URL(canonical).host;
  const hosts = (env.ABRAHAMMOSES_LEGACY_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter((o) => /^https?:\/\/[^/\s]+$/.test(o))
    .map((o) => new URL(o).host)
    .filter((h, i, all) => h !== canonicalHost && all.indexOf(h) === i);
  return hosts.flatMap((host) => [
    { source: '/', has: [{ type: 'host', value: host }], destination: `${canonical}/`, permanent: true },
    {
      source: '/:path((?!api/|api$|mcp$|mcp/|_next/).+)',
      has: [{ type: 'host', value: host }],
      destination: `${canonical}/:path`,
      permanent: true,
    },
  ]);
}
