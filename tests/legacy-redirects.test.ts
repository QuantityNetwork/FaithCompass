import { describe, expect, it } from 'vitest';
import { legacyHostRedirects } from '../src/lib/site/legacy-redirects.mjs';

const ON = {
  ABRAHAMMOSES_REDIRECT_LEGACY_HOSTS: '1',
  ABRAHAMMOSES_PUBLIC_ORIGIN: 'https://abrahammoses.com/',
  ABRAHAMMOSES_LEGACY_ORIGINS: 'https://abraham.sagolik.com, https://abrahammoses.com',
};

/** Mirror of the source pattern, to check which paths a rule would catch. */
const caught = (path: string) => /^\/(?!api\/|api$|mcp$|mcp\/|_next\/).+$/.test(path);

describe('legacy host redirects', () => {
  it('are off unless explicitly enabled, so merging changes nothing', () => {
    expect(legacyHostRedirects({})).toEqual([]);
    expect(legacyHostRedirects({ ...ON, ABRAHAMMOSES_REDIRECT_LEGACY_HOSTS: undefined })).toEqual([]);
    expect(legacyHostRedirects({ ...ON, ABRAHAMMOSES_REDIRECT_LEGACY_HOSTS: 'true' })).toEqual([]);
  });

  it('need an https canonical origin to point at', () => {
    expect(legacyHostRedirects({ ...ON, ABRAHAMMOSES_PUBLIC_ORIGIN: undefined })).toEqual([]);
    expect(legacyHostRedirects({ ...ON, ABRAHAMMOSES_PUBLIC_ORIGIN: 'http://localhost:3000' })).toEqual([]);
  });

  it('send every page on a previous host to the same path on the canonical origin, permanently', () => {
    const rules = legacyHostRedirects(ON);
    expect(rules).toHaveLength(2); // the canonical host itself is never redirected
    for (const r of rules) {
      expect(r.has).toEqual([{ type: 'host', value: 'abraham.sagolik.com' }]);
      expect(r.permanent).toBe(true);
      expect(r.destination.startsWith('https://abrahammoses.com/')).toBe(true);
    }
    expect(rules[0]).toMatchObject({ source: '/', destination: 'https://abrahammoses.com/' });
    expect(rules[1].destination).toBe('https://abrahammoses.com/:path');
  });

  it('leave the REST API, the MCP endpoint and static assets answering on the old host', () => {
    for (const p of ['/api/v1', '/api/v1/claims', '/api/public/mcp', '/api', '/mcp', '/mcp/x', '/_next/static/a.js']) {
      expect(caught(p), p).toBe(false);
    }
    for (const p of ['/claims', '/claims/AM-CLAIM-000184', '/research/torah-permanence', '/developers', '/mcp-guide', '/apis', '/sitemap.xml']) {
      expect(caught(p), p).toBe(true);
    }
    expect(legacyHostRedirects(ON)[1].source).toBe('/:path((?!api/|api$|mcp$|mcp/|_next/).+)');
  });
});
