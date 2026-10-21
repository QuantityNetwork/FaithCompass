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
 * else is locked down: no plugins, no foreign frames (except the Firebase auth domain on the workspace pages, for
 * Google sign-in), no foreign connections (except Firebase's
 * Auth and Firestore endpoints when it is configured),
 * forms post only here, and <base> cannot be changed.
 */
function contentSecurityPolicy(env, { googleSignIn = false } = {}) {
  const dev = env.NODE_ENV !== 'production';
  // Vercel's preview toolbar, on preview deployments only.
  const toolbar = env.VERCEL_ENV === 'preview' ? ' https://vercel.live' : '';
  // Firebase browser SDK (ADR 0001): Email/Password sign-in, token refresh and Firestore, only when the public web
  // config is set.
  const firebase = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    ? ' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com'
    : '';
  // Google sign-in (workspace pages only): the SDK loads Google's gapi loader and frames the project's auth
  // domain, which relays the pop-up or redirect result back to this page.
  const authDomain = googleSignIn && env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? googleAuthDomain(env) : '';
  const gapi = authDomain ? ' https://apis.google.com' : '';
  const authFrame = authDomain ? ` https://${authDomain}` : '';
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}${gapi}${toolbar}`,
    `style-src 'self' 'unsafe-inline'${toolbar}`,
    `img-src 'self' data: blob:${toolbar}`,
    `font-src 'self' data:${toolbar}`,
    `connect-src 'self'${firebase}${toolbar}${toolbar ? ' wss://ws-us3.pusher.com' : ''}`,
    `frame-src 'self'${authFrame}${toolbar}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join('; ');
}

/** The Firebase auth domain from the public web config, only if it is a plain hostname. */
function googleAuthDomain(env) {
  const d = (env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || `${env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebaseapp.com`).trim();
  return /^[a-z0-9.-]+$/i.test(d) ? d : '';
}

// The workspace and its sign-in page: the Firebase SDK there may start its pop-up/redirect relay frame on load.
const WORKSPACE_PATHS = ['/institutional/workspace', '/institutional/workspace/:path*'];

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
      // Workspace pages: Google sign-in needs gapi and the auth-domain frame, and a pop-up the page opened must be able
      // to report back (same-origin-allow-popups). Overrides the two headers above for these paths only.
      ...WORKSPACE_PATHS.map((source) => ({
        source,
        headers: [
          { key: 'Content-Security-Policy', value: contentSecurityPolicy(process.env, { googleSignIn: true }) },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
        ],
      })),
      {
        // Self-hosted fonts: file names carry a content hash, so they never change.
        source: '/fonts/:file*.woff2',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};

export default nextConfig;
