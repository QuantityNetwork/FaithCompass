/**
 * Every navigation link on the site, in one place.
 *
 * tests/site-links.test.ts resolves each internal href against the app's
 * routes, so a footer link to a page that does not exist fails the build —
 * the review found Privacy and Terms links that returned 404.
 */

export interface NavLink {
  href: string;
  label: string;
}

export const PRIMARY_NAV: NavLink[] = [
  { href: '/research', label: 'Research' },
  { href: '/claims', label: 'Claims' },
  { href: '/covenants', label: 'Covenants' },
  { href: '/doctrine', label: 'Doctrine' },
  { href: '/traditions', label: 'Traditions' },
  { href: '/hermeneutics', label: 'Hermeneutics' },
  { href: '/methodology', label: 'Method' },
  { href: '/developers', label: 'Developers' },
  { href: '/about', label: 'About' },
];

export const FOOTER_NAV: Array<{ title: string; links: NavLink[] }> = [
  {
    title: 'Research',
    links: [
      { href: '/research', label: 'Research workspace' },
      { href: '/research/torah-permanence', label: 'Torah permanence' },
      { href: '/research/priesthood-new-covenant', label: 'Priesthood' },
      { href: '/research/ibrahim-heirs-and-revelation', label: 'Ibrāhīm and revelation' },
      { href: '/research/restoration-priesthood-authority', label: 'Restoration and authority' },
      { href: '/compare', label: 'Compare traditions' },
    ],
  },
  {
    title: 'Record',
    links: [
      { href: '/claims', label: 'Claim Ledger' },
      { href: '/covenants', label: 'Covenant Map' },
      { href: '/doctrine', label: 'Doctrine Graph' },
      { href: '/traditions', label: 'Traditions' },
      { href: '/hermeneutics', label: 'Hermeneutics' },
      { href: '/corpus', label: 'Corpus' },
      { href: '/evidence', label: 'Evidence assessments' },
      { href: '/changelog', label: 'Changelog' },
    ],
  },
  {
    title: 'Method',
    links: [
      { href: '/methodology', label: 'Methodology' },
      { href: '/system', label: 'The AbrahamMoses System' },
      { href: '/about', label: 'About and governance' },
    ],
  },
  {
    title: 'Access',
    links: [
      { href: '/developers', label: 'Developers' },
      { href: '/developers#mcp', label: 'MCP server' },
      { href: '/api/v1', label: 'REST API' },
      { href: '/api/v1/openapi.json', label: 'OpenAPI' },
      { href: '/status', label: 'Status' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/privacy', label: 'Privacy' },
      { href: '/terms', label: 'Terms' },
    ],
  },
];
