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
} from '@/components/brand/paths';

const ROOT = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');
const traced = JSON.parse(read('design/brand/logo-paths.json'));
const corporate = JSON.parse(read('design/brand/corporate/logo-paths.json'));

describe('brand assets', () => {
  it('are all generated from the traced logos, so none can drift from them', () => {
    expect(EMBLEM_PATH).toBe(traced.parts.emblem);
    expect(LOGO_VIEWBOX).toEqual({ width: corporate.width, height: corporate.height });
    expect(MARK_VIEWBOX).toEqual({ width: corporate.markWidth, height: corporate.markHeight });
    for (const file of ['public/brand/abrahammoses-logo.svg', 'public/brand/abrahammoses-logo-ivory.svg']) {
      const svg = read(file);
      expect(svg, file).toContain(corporate.parts.mark);
      expect(svg, file).toContain(corporate.parts.wordmark);
      expect(svg, file).toContain('aria-label="AbrahamMoses"');
    }
    for (const file of ['public/brand/abrahammoses-mark.svg', 'public/brand/abrahammoses-mark-ivory.svg', 'src/app/icon.svg']) {
      expect(read(file), file).toContain(corporate.parts.mark);
    }
    expect(read('public/brand/abrahammoses-emblem.svg')).toContain(traced.parts.emblem);
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
