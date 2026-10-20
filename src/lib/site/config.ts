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

/**
 * The operator is a private individual (owner instruction 2026-10-20). "Sagolik" is a brand name he uses, not a
 * company: there is no organisation number and no VAT registration.
 */
export const OPERATOR = {
  name: 'Mikael Markus Andersson',
  brand: 'Sagolik',
  status: 'private individual, Sweden',
  statement:
    'Written and built by Mikael Markus Andersson (private individual, Sweden) under the Sagolik name; Sagolik is a brand, not a company. All intellectual property rights in AbrahamMoses are owned by Mikael Markus Andersson.',
};

/** Minor versions are additive; see CHANGELOG.md. 1.1 (2026-10-20): epistemic_status fields, headline_confidence deprecated. */
export const API_VERSION = '1.1';
export const MCP_SERVER_VERSION = '1.0.0';

function trim(origin: string): string {
  return origin.replace(/\/+$/, '');
}

/**
 * A Vercel preview names itself: its branch URL, which is stable across pushes, or failing that
 * its deployment URL. Otherwise a preview would print the project's production domain, which
 * serves a different build and possibly a different app.
 */
function vercelPreviewHost(): string | null {
  if (process.env.VERCEL_ENV !== 'preview') return null;
  return process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL || null;
}

/** Where the configured canonical origin came from, for the status page. */
export function canonicalOriginSource(): 'configured' | 'vercel-preview' | 'vercel-production' | 'fallback' {
  if (process.env.ABRAHAMMOSES_PUBLIC_ORIGIN) return 'configured';
  if (vercelPreviewHost()) return 'vercel-preview';
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return 'vercel-production';
  return 'fallback';
}

export function canonicalOrigin(): string {
  if (process.env.ABRAHAMMOSES_PUBLIC_ORIGIN) return trim(process.env.ABRAHAMMOSES_PUBLIC_ORIGIN);
  const preview = vercelPreviewHost();
  if (preview) return `https://${trim(preview)}`;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${trim(process.env.VERCEL_PROJECT_PRODUCTION_URL)}`;
  return 'http://localhost:3000';
}

/**
 * Earlier canonical origins that keep serving the same deployment after a domain move
 * (ABRAHAMMOSES_LEGACY_ORIGINS, comma-separated, e.g. `https://abraham.sagolik.com`).
 * They are listed as secondary servers in the OpenAPI document and named on the developer
 * page, so clients configured with them know they still work; the status page treats a
 * request arriving on one as expected. Empty unless configured; never includes the canonical origin.
 */
export function legacyOrigins(): string[] {
  const canonical = canonicalOrigin();
  return (process.env.ABRAHAMMOSES_LEGACY_ORIGINS ?? '')
    .split(',')
    .map((o) => trim(o.trim()))
    .filter((o) => /^https?:\/\/[^/\s]+$/.test(o) && o !== canonical)
    .filter((o, i, all) => all.indexOf(o) === i);
}

export function absoluteUrl(path: string): string {
  return `${canonicalOrigin()}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Contact addresses published in the legal pages, when the operator has configured them. */
export function legalContact(): { privacy: string | null; general: string | null } {
  return {
    // Without a dedicated privacy address, privacy requests go to the operator's contact address.
    privacy: process.env.ABRAHAMMOSES_PRIVACY_CONTACT || process.env.ABRAHAMMOSES_CONTACT || null,
    general: process.env.ABRAHAMMOSES_CONTACT || null,
  };
}
