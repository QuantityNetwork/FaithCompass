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
} from '@/components/brand/paths';

const ROOT = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');
const traced = JSON.parse(read('design/brand/logo-paths.json'));

describe('brand assets', () => {
  it('are all generated from the traced logo, so none can drift from it', () => {
    expect(EMBLEM_PATH).toBe(traced.parts.emblem);
    expect(LOGO_VIEWBOX).toEqual({ width: traced.width, height: traced.height });
    for (const file of ['public/brand/abrahammoses-logo.svg', 'public/brand/abrahammoses-logo-ivory.svg']) {
      const svg = read(file);
      expect(svg, file).toContain(traced.parts.emblem);
      expect(svg, file).toContain(traced.parts.wordmark);
      expect(svg, file).toContain('aria-label="AbrahamMoses"');
    }
    expect(read('public/brand/abrahammoses-emblem.svg')).toContain(traced.parts.emblem);
    expect(read('src/app/icon.svg')).toContain(traced.parts.emblem);
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
