import { legacyHostRedirects } from './src/lib/site/legacy-redirects.mjs';

/**
 * Content Security Policy.
 *
 * Every script, style, font and image is served from this origin (next/font
 * self-hosts the fonts). Scripts still need 'unsafe-inline': the App Router
 * streams its payload in inline <script> tags and the theme is set by an inline
 * script before paint. A nonce would remove that, but only by rendering every
 * page per request, which would give up static rendering and the CDN cache;
 * that trade-off is recorded in docs/RELEASE_BLOCKERS.md (E12). Everything
 * else is locked down: no plugins, no foreign frames, no foreign connections,
 * forms post only here, and <base> cannot be changed.
 */
function contentSecurityPolicy(env) {
  const dev = env.NODE_ENV !== 'production';
  // Vercel's preview toolbar, on preview deployments only.
  const toolbar = env.VERCEL_ENV === 'preview' ? ' https://vercel.live' : '';
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}${toolbar}`,
    `style-src 'self' 'unsafe-inline'${toolbar}`,
    `img-src 'self' data: blob:${toolbar}`,
    `font-src 'self' data:${toolbar}`,
    `connect-src 'self'${toolbar}${toolbar ? ' wss://ws-us3.pusher.com' : ''}`,
    `frame-src 'self'${toolbar}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join('; ');
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // No framework fingerprint header.
  poweredByHeader: false,
  // Render metadata in <head> for every client, not only recognised crawlers,
  // so titles, descriptions and canonical links are present in the initial HTML
  // whatever reads it.
  htmlLimitedBots: /.*/,
  experimental: {
    // Evidence analyses are persisted through the store abstraction, not the
    // Next data cache; keep server actions modest.
    serverActions: { bodySizeLimit: '2mb' },
  },
  // Previous hosts → canonical origin. Empty (no redirects) unless ABRAHAMMOSES_REDIRECT_LEGACY_HOSTS=1.
  async redirects() {
    return legacyHostRedirects(process.env);
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()' },
          { key: 'Content-Security-Policy', value: contentSecurityPolicy(process.env) },
          // Two years, this host only. includeSubDomains/preload are an owner decision (they bind every subdomain).
          { key: 'Strict-Transport-Security', value: 'max-age=63072000' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
