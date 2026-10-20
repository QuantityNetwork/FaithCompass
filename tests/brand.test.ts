import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  EMBLEM_CENTRE,
  EMBLEM_NODES,
  EMBLEM_PATH,
  EMBLEM_SPARKLE_PATH,
  EMBLEM_VIEWBOX,
  LOGO_VIEWBOX,
  MARK_VIEWBOX,
  STACKED_LOGO_VIEWBOX,
} from '@/components/brand/paths';

const ROOT = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');
const traced = JSON.parse(read('design/brand/logo-paths.json'));
const corporate = JSON.parse(read('design/brand/corporate/logo-paths.json'));
const official = JSON.parse(read('design/brand/official/logo-paths.json'));
const pathsIn = (svg: string) => [...svg.matchAll(/ d="([^"]+)"/g)].map((m) => m[1]);
/** The command letters of a path: identical when one path is the other moved or scaled. */
const commands = (d: string) => d.replace(/[^MLCZ]/g, '');
const numbers = (d: string) => (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);

describe('brand assets', () => {
  it('are all generated from the traced logos, so none can drift from them', () => {
    expect(EMBLEM_PATH).toBe(traced.parts.emblem);
    expect(STACKED_LOGO_VIEWBOX).toEqual({ width: corporate.width, height: corporate.height });
    expect(MARK_VIEWBOX).toEqual({ width: corporate.markWidth, height: corporate.markHeight });
    for (const file of ['public/brand/abrahammoses-logo-stacked.svg', 'public/brand/abrahammoses-logo-stacked-ivory.svg']) {
      const svg = read(file);
      expect(svg, file).toContain(corporate.parts.mark);
      expect(svg, file).toContain(corporate.parts.wordmark);
      expect(svg, file).toContain('aria-label="AbrahamMoses"');
    }
    for (const file of ['public/brand/abrahammoses-logo.svg', 'public/brand/abrahammoses-logo-ivory.svg']) {
      // The primary logo is the official one-word lockup, exactly as traced.
      const svg = read(file);
      expect(svg, file).toContain(official.parts.mark);
      expect(svg, file).toContain(official.parts.wordmark);
      expect(svg, file).toContain(`viewBox="0 0 ${LOGO_VIEWBOX.width} ${LOGO_VIEWBOX.height}"`);
      expect(svg, file).toContain('aria-label="AbrahamMoses"');
    }
    expect(LOGO_VIEWBOX).toEqual({ width: official.width, height: official.height });
    const [wordD] = pathsIn(read('public/brand/abrahammoses-wordmark.svg'));
    expect(commands(wordD)).toBe(commands(official.parts.wordmark));
    for (const file of ['public/brand/abrahammoses-mark.svg', 'public/brand/abrahammoses-mark-ivory.svg', 'src/app/icon.svg']) {
      expect(read(file), file).toContain(corporate.parts.mark);
    }
    expect(read('public/brand/abrahammoses-emblem.svg')).toContain(traced.parts.emblem);
  });

  it('sets the primary wordmark on one line, with the mark beside it', () => {
    // One line: the wordmark is far wider than tall, and much shorter than the stacked two lines.
    expect(LOGO_VIEWBOX.width / LOGO_VIEWBOX.height).toBeGreaterThan(6);
    const [markD, wordD] = pathsIn(read('public/brand/abrahammoses-logo.svg'));
    const xs = (d: string) => numbers(d).filter((_, i) => i % 2 === 0);
    const ys = (d: string) => numbers(d).filter((_, i) => i % 2 === 1);
    expect(Math.max(...xs(markD))).toBeLessThan(Math.min(...xs(wordD)));
    expect(Math.max(...ys(wordD)) - Math.min(...ys(wordD))).toBeLessThan(corporate.height * 0.42);
    for (const v of [...numbers(markD), ...numbers(wordD)]) expect(v).toBeGreaterThanOrEqual(-0.01);
    for (const d of [markD, wordD]) {
      expect(Math.max(...xs(d))).toBeLessThanOrEqual(LOGO_VIEWBOX.width + 0.01);
      expect(Math.max(...ys(d))).toBeLessThanOrEqual(LOGO_VIEWBOX.height + 0.01);
    }
  });

  it('ships the favicon set and the web manifest icons', () => {
    const png = (rel: string) => readFileSync(join(ROOT, rel));
    for (const rel of ['public/favicon-16x16.png', 'public/favicon-32x32.png', 'public/android-chrome-192x192.png', 'public/android-chrome-512x512.png', 'public/maskable-512x512.png', 'src/app/apple-icon.png', 'src/app/opengraph-image.png']) {
      expect(png(rel).subarray(1, 4).toString(), rel).toBe('PNG');
    }
    const ico = png('src/app/favicon.ico');
    expect([ico.readUInt16LE(0), ico.readUInt16LE(2), ico.readUInt16LE(4)]).toEqual([0, 1, 3]); // ICO with 3 images
  });

  it('places the four rings symmetrically around the centre star, inside the emblem', () => {
    const { top, right, bottom, left } = EMBLEM_NODES;
    for (const n of Object.values(EMBLEM_NODES)) {
      expect(n.x).toBeGreaterThan(0);
      expect(n.x).toBeLessThan(EMBLEM_VIEWBOX.width);
      expect(n.y).toBeGreaterThan(0);
      expect(n.y).toBeLessThan(EMBLEM_VIEWBOX.height);
      expect(Math.hypot(n.x - EMBLEM_CENTRE.x, n.y - EMBLEM_CENTRE.y)).toBeGreaterThan(90);
    }
    expect(Math.abs(top.x - bottom.x)).toBeLessThan(4);
    expect(Math.abs(left.y - right.y)).toBeLessThan(4);
    expect(EMBLEM_PATH).toContain(EMBLEM_SPARKLE_PATH);
  });
});
