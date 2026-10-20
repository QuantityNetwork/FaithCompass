import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ENDPOINTS_V1 } from '@/lib/api/v1';
import { getRecord } from '@/lib/record/record';
import { FOOTER_NAV, NAV_SECTIONS, PRIMARY_NAV } from '@/lib/site/nav';
import { buildSearchIndex } from '@/lib/site/search-index';

const APP = join(__dirname, '../src/app');

/** Resolve a site path to a page in the app directory, following dynamic segments. */
function resolvePage(path: string): string | null {
  const segments = path.split('/').filter(Boolean);
  let dir = APP;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (existsSync(join(dir, seg))) {
      dir = join(dir, seg);
      continue;
    }
    const entries = readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory());
    const catchAll = entries.find((e) => /^\[\[?\.\.\./.test(e.name));
    if (catchAll) return existsSync(join(dir, catchAll.name, 'page.tsx')) ? join(dir, catchAll.name) : null;
    const dynamic = entries.find((e) => /^\[[^.]+\]$/.test(e.name));
    if (!dynamic) return null;
    dir = join(dir, dynamic.name);
  }
  return existsSync(join(dir, 'page.tsx')) ? dir : null;
}

describe('site navigation', () => {
  const links = [...PRIMARY_NAV, ...FOOTER_NAV.flatMap((g) => g.links), ...NAV_SECTIONS.flatMap((s) => s.pages)];

  it('has no dead internal links in the header or footer', () => {
    for (const link of links) {
      const path = link.href.split('#')[0];
      if (path.startsWith('/api/v1')) {
        const sub = path.slice('/api/v1'.length) || '/';
        expect(ENDPOINTS_V1.some((e) => e.path === sub), link.href).toBe(true);
        continue;
      }
      expect(resolvePage(path), `${link.label} → ${link.href}`).not.toBeNull();
    }
  });

  it('has no dead links in the command palette index', () => {
    for (const item of buildSearchIndex().items) {
      expect(resolvePage(item.u.split('#')[0]), `${item.t} → ${item.u}`).not.toBeNull();
    }
  });

  it('links only to research cases that exist', () => {
    const record = getRecord();
    for (const link of links.filter((l) => l.href.startsWith('/research/'))) {
      expect(record.researchCase(link.href.split('/')[2]), link.href).toBeDefined();
    }
  });

  it('publishes standalone Privacy and Terms pages', () => {
    expect(resolvePage('/privacy')).not.toBeNull();
    expect(resolvePage('/terms')).not.toBeNull();
    expect(links.map((l) => l.href)).toEqual(expect.arrayContaining(['/privacy', '/terms']));
  });
});
