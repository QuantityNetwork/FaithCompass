/**
 * Every navigation link on the site, in one place.
 *
 * The primary navigation follows the information architecture of the v2 design
 * (master prompt §6.1): Research, Evidence, Compare, Methodology, Developers,
 * Institutional. Every existing page belongs to exactly one section; the
 * section bar under the header lists a section's pages, so no page lost its
 * way in when the header shrank from nine links to six.
 *
 * tests/site-links.test.ts resolves each internal href against the app's
 * routes, so a link to a page that does not exist fails the build.
 */

/**
 * The Decision Passport hub (/institutional/decision-passport). Its menu slot sits after Deep Analysis and is shown
 * while `live` is true (site-links.test.ts fails on a dead link).
 */
export const DECISION_PASSPORT_HUB: { href: string; label: string; live: boolean } = { href: '/institutional/decision-passport', label: 'Decision Passport', live: true };

export interface NavLink {
  href: string;
  label: string;
}

export interface NavSection extends NavLink {
  /** Path prefixes that belong to this section (for aria-current and the section bar). */
  match: string[];
  /** The section's pages, shown in the section bar and the footer. */
  pages: NavLink[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    href: '/research',
    label: 'Research',
    match: ['/research'],
    pages: [
      { href: '/research', label: 'Research workspace' },
      { href: '/research/torah-permanence', label: 'Torah permanence' },
      { href: '/research/priesthood-new-covenant', label: 'Priesthood' },
      { href: '/research/ibrahim-heirs-and-revelation', label: 'Ibrāhīm and revelation' },
      { href: '/research/restoration-priesthood-authority', label: 'Restoration and authority' },
    ],
  },
  {
    href: '/claims',
    label: 'Evidence',
    match: ['/claims', '/evidence', '/covenants', '/doctrine', '/traditions', '/corpus', '/changelog'],
    pages: [
      { href: '/claims', label: 'Claim ledger' },
      { href: '/corpus', label: 'Source library' },
      { href: '/covenants', label: 'Covenant map' },
      { href: '/doctrine', label: 'Doctrine graph' },
      { href: '/traditions', label: 'Traditions' },
      { href: '/evidence', label: 'Evidence assessments' },
      { href: '/changelog', label: 'Changelog' },
    ],
  },
  {
    href: '/compare',
    label: 'Compare',
    match: ['/compare'],
    pages: [{ href: '/compare', label: 'Compare traditions' }],
  },
  {
    href: '/methodology',
    label: 'Methodology',
    match: ['/methodology', '/hermeneutics', '/system'],
    pages: [
      { href: '/methodology', label: 'Methodology' },
      { href: '/hermeneutics', label: 'Hermeneutics and assumptions' },
      { href: '/system', label: 'The AbrahamMoses System' },
    ],
  },
  {
    href: '/developers',
    label: 'Developers',
    match: ['/developers', '/status'],
    pages: [
      { href: '/developers', label: 'Developers' },
      { href: '/developers#mcp', label: 'MCP server' },
      { href: '/api/v1', label: 'REST API' },
      { href: '/api/v1/openapi.json', label: 'OpenAPI' },
      { href: '/status', label: 'Status' },
    ],
  },
  {
    href: '/institutional',
    label: 'Institutional',
    match: ['/institutional', '/about', '/privacy', '/terms'],
    pages: [
      { href: '/institutional', label: 'Institutional' },
      { href: '/institutional/decision-twin', label: 'Decision Twin' },
      { href: '/institutional/decision-room', label: 'Decision Room' },
      { href: '/institutional/workspace/deep-analysis', label: 'Deep Analysis' },
      // Decision Passport hub; shown while DECISION_PASSPORT_HUB.live is true.
      ...(DECISION_PASSPORT_HUB.live ? [{ href: DECISION_PASSPORT_HUB.href, label: DECISION_PASSPORT_HUB.label }] : []),
      { href: '/about', label: 'About and governance' },
      { href: '/privacy', label: 'Privacy' },
      { href: '/terms', label: 'Terms' },
      { href: '/institutional/decision-twin/terms', label: 'Terms of Sale' },
    ],
  },
];

export const PRIMARY_NAV: NavLink[] = NAV_SECTIONS.map(({ href, label }) => ({ href, label }));

export const FOOTER_NAV: Array<{ title: string; links: NavLink[] }> = NAV_SECTIONS.map((s) => ({
  title: s.label,
  links: s.pages,
}));

/** The section a path belongs to, if any. */
export function sectionFor(pathname: string): NavSection | undefined {
  return NAV_SECTIONS.find((s) => s.match.some((m) => pathname === m || pathname.startsWith(`${m}/`)));
}
