/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Evidence analyses are persisted through the store abstraction, not the
    // Next data cache; keep server actions modest.
    serverActions: { bodySizeLimit: '2mb' },
  },
};

export default nextConfig;
