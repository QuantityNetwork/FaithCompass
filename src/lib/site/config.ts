/**
 * Site identity and the canonical origin.
 *
 * Every URL the site prints — in API responses, the MCP manifest, the
 * developer documentation, canonical links and the sitemap — comes from
 * canonicalOrigin(), so the documented host and the serving host cannot drift
 * apart the way abrahammoses.org and am.sagolik.com did. The status page
 * reports whether the origin is configured and whether requests arrive on it.
 */

export const SITE_NAME = 'AbrahamMoses';
export const SITE_TAGLINE = 'Structured Theological Intelligence';
export const SITE_DESCRIPTION =
  'A structured theological research record: sources, claims, covenants, doctrine and traditions, with every conclusion traceable to its source and open to challenge.';

export const OPERATOR = {
  name: 'Sagolik',
  statement:
    'Written and built by Sagolik. All intellectual property rights in AbrahamMoses are owned by Sagolik.',
};

export const API_VERSION = '1.0';
export const MCP_SERVER_VERSION = '1.0.0';

function trim(origin: string): string {
  return origin.replace(/\/+$/, '');
}

/** Where the configured canonical origin came from, for the status page. */
export function canonicalOriginSource(): 'configured' | 'vercel-production' | 'fallback' {
  if (process.env.ABRAHAMMOSES_PUBLIC_ORIGIN) return 'configured';
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return 'vercel-production';
  return 'fallback';
}

export function canonicalOrigin(): string {
  if (process.env.ABRAHAMMOSES_PUBLIC_ORIGIN) return trim(process.env.ABRAHAMMOSES_PUBLIC_ORIGIN);
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${trim(process.env.VERCEL_PROJECT_PRODUCTION_URL)}`;
  return 'http://localhost:3000';
}

export function absoluteUrl(path: string): string {
  return `${canonicalOrigin()}${path.startsWith('/') ? path : `/${path}`}`;
}

export const ENDPOINTS = {
  mcp: '/mcp',
  legacyMcp: '/api/public/mcp',
  rest: '/api/v1',
  openapi: '/api/v1/openapi.json',
} as const;

/** Contact addresses published in the legal pages, when the operator has configured them. */
export function legalContact(): { privacy: string | null; general: string | null } {
  return {
    privacy: process.env.ABRAHAMMOSES_PRIVACY_CONTACT || null,
    general: process.env.ABRAHAMMOSES_CONTACT || null,
  };
}
