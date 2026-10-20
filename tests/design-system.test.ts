import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ExampleChip, OutcomeChip, ReviewChip, ReviewTrack } from '@/components/ds/status';
import { Cite, Footnotes } from '@/components/ds/footnotes';
import { EPISTEMIC_META, EPISTEMIC_STATUSES } from '@/lib/epistemic';
import { getRecord } from '@/lib/record/record';
import { NAV_SECTIONS, PRIMARY_NAV, sectionFor } from '@/lib/site/nav';
import { buildSearchIndex } from '@/lib/site/search-index';

describe('global navigation', () => {
  it('is exactly Research, Evidence, Compare, Methodology, Developers, Institutional', () => {
    expect(PRIMARY_NAV.map((l) => l.label)).toEqual(['Research', 'Evidence', 'Compare', 'Methodology', 'Developers', 'Institutional']);
  });

  it('places every existing page in a section', () => {
    const cases: Array<[string, string | undefined]> = [
      ['/', undefined],
      ['/research', 'Research'],
      ['/research/torah-permanence', 'Research'],
      ['/claims/AM-CLAIM-000187', 'Evidence'],
      ['/evidence/daniel/12/1', 'Evidence'],
      ['/covenants', 'Evidence'],
      ['/doctrine', 'Evidence'],
      ['/traditions/rabbinic-judaism', 'Evidence'],
      ['/corpus', 'Evidence'],
      ['/changelog', 'Evidence'],
      ['/compare', 'Compare'],
      ['/methodology', 'Methodology'],
      ['/hermeneutics', 'Methodology'],
      ['/system', 'Methodology'],
      ['/developers', 'Developers'],
      ['/status', 'Developers'],
      ['/institutional', 'Institutional'],
      ['/about', 'Institutional'],
      ['/privacy', 'Institutional'],
      ['/terms', 'Institutional'],
    ];
    for (const [path, label] of cases) expect(sectionFor(path)?.label, path).toBe(label);
  });

  it('does not match a section by a bare prefix', () => {
    expect(sectionFor('/researchers')).toBeUndefined();
  });

  it('lists each section page once', () => {
    for (const s of NAV_SECTIONS) {
      const hrefs = s.pages.map((p) => p.href);
      expect(new Set(hrefs).size, s.label).toBe(hrefs.length);
    }
  });
});

describe('command palette index', () => {
  const record = getRecord();
  const { items } = buildSearchIndex();

  it('covers every case, claim, assumption, counter-model, tradition and work in the record', () => {
    const urls = new Set(items.map((i) => i.u));
    for (const c of record.data.cases) expect(urls.has(`/research/${c.slug}`)).toBe(true);
    for (const c of record.data.claims) expect(urls.has(`/claims/${c.code}`)).toBe(true);
    for (const a of record.data.axioms) expect(urls.has(`/hermeneutics#${a.code}`)).toBe(true);
    for (const m of record.data.counterModels) expect(urls.has(`/hermeneutics#${m.code}`)).toBe(true);
    for (const t of record.data.traditions) expect(urls.has(`/traditions/${t.id}`)).toBe(true);
    expect(items.filter((i) => i.g === 'Sources')).toHaveLength(record.data.works.length);
  });

  it('carries current statements, not a snapshot', () => {
    for (const c of record.data.claims) {
      const item = items.find((i) => i.u === `/claims/${c.code}`)!;
      expect(item.t).toBe(record.current(c).statement);
    }
  });

  it('points only at site paths', () => {
    for (const i of items) expect(i.u, i.t).toMatch(/^\/(?!\/)/);
  });
});

describe('status indicators', () => {
  const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

  it('labels the review states in the PR #7 wording, with a symbol hidden from assistive technology', () => {
    expect(html(createElement(ReviewChip, { status: 'provisional' }))).toContain('Provisional · awaiting editorial review');
    expect(html(createElement(ReviewChip, { status: 'published' }))).toContain('Editor-verified');
    expect(html(createElement(ReviewChip, { status: 'externally_reviewed' }))).toContain('Externally reviewed');
    expect(html(createElement(ReviewChip, { status: 'provisional' }))).toMatch(/<i aria-hidden="true">◐<\/i>/);
  });

  it('never shows a provisional revision as editorially reviewed in the publication track', () => {
    const track = html(createElement(ReviewTrack, { status: 'provisional' }));
    expect(track).toContain('Editorially reviewed · pending');
    expect(track).toContain('Source-validated · not recorded');
    expect(track).not.toMatch(/Editorially reviewed ✓/);
  });

  it('uses the exact §6.4 outcome wording', () => {
    for (const s of EPISTEMIC_STATUSES) expect(html(createElement(OutcomeChip, { status: s }))).toContain(EPISTEMIC_META[s].label);
  });

  it('labels illustrative material as example data', () => {
    expect(html(createElement(ExampleChip))).toContain('Example data');
  });

  it('links footnote references and back-links both ways', () => {
    const out = html(createElement('div', null, createElement(Cite, { n: 1, scope: 's' }), createElement(Footnotes, { scope: 's', notes: ['A note.'] })));
    expect(out).toContain('href="#s-1"');
    expect(out).toContain('id="s-1"');
    expect(out).toContain('href="#s-ref-1"');
    expect(out).toContain('id="s-ref-1"');
  });
});

/* ------------------------------------------------------------------ WCAG 2.2 AA contrast of the tokens */

function block(css: string, selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  const body = css.slice(start, css.indexOf('}', start));
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

type RGBA = [number, number, number, number];
function parse(c: string): RGBA {
  if (c.startsWith('#')) {
    const h = c.slice(1);
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
  }
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (!m) throw new Error(`cannot parse ${c}`);
  const [r, g, b, a = '1'] = m[1].split(',').map((s) => s.trim());
  return [Number(r), Number(g), Number(b), Number(a)];
}
function over(top: RGBA, base: RGBA): RGBA {
  const a = top[3];
  return [top[0] * a + base[0] * (1 - a), top[1] * a + base[1] * (1 - a), top[2] * a + base[2] * (1 - a), 1];
}
function lum([r, g, b]: RGBA) {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a: RGBA, b: RGBA) {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

describe('design tokens meet WCAG 2.2 AA (4.5:1 for text)', () => {
  const css = readFileSync(join(__dirname, '../src/app/ds.css'), 'utf8');
  // Design D: warm off-white is the default (:root); navy is the optional dark mode.
  const light = block(css, ':root');
  const dark = { ...light, ...block(css, "[data-theme='dark']") };
  const themes: Record<string, Record<string, string>> = { light, dark };
  const TEXT = ['ink', 'ink-2', 'muted', 'accent', 'ink-faint', 'rust-text', 'ok', 'part', 'weak', 'no', 'ins', 'disp', 'ex'];
  const GROUNDS = ['bg', 'surface', 'surface-2', 'raised'];

  for (const [name, t] of Object.entries(themes)) {
    it(`${name}: text tokens on every ground`, () => {
      for (const fg of TEXT) {
        for (const bg of GROUNDS) {
          const ratio = contrast(parse(t[fg]), parse(t[bg]));
          expect(ratio, `${name} --${fg} on --${bg} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    });

    it(`${name}: status chips on their own tinted backgrounds`, () => {
      for (const k of ['ok', 'part', 'weak', 'no', 'ins', 'disp', 'ex']) {
        for (const ground of ['bg', 'surface']) {
          const bg = over(parse(t[`${k}-bg`]), parse(t[ground]));
          const ratio = contrast(parse(t[k]), bg);
          expect(ratio, `${name} --${k} on --${k}-bg over --${ground} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    });
  }

  it('gold buttons carry navy text', () => {
    expect(contrast(parse('#091121'), parse(light['brand-gold']))).toBeGreaterThanOrEqual(4.5);
  });
});
