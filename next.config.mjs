/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Render metadata in <head> for every client, not only recognised crawlers,
  // so titles, descriptions and canonical links are present in the initial HTML
  // whatever reads it.
  htmlLimitedBots: /.*/,
  experimental: {
    // Evidence analyses are persisted through the store abstraction, not the
    // Next data cache; keep server actions modest.
    serverActions: { bodySizeLimit: '2mb' },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
