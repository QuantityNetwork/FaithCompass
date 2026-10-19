/**
 * Derive every brand asset from the traced logos.
 *
 *   npm run brand:build            write the assets
 *   npm run brand:build -- --check also render the logo at the master's scale for comparison
 *
 * Inputs:
 *   design/brand/corporate/logo-paths.json  the corporate logo: "A" mark + two-line wordmark
 *                                           (from scripts/brand/trace_corporate.py)
 *   design/brand/logo-paths.json            the four-ring emblem, used by the homepage introduction
 *                                           (from scripts/brand/trace_logo.py)
 * Output:
 *   src/components/brand/paths.ts     path data and emblem geometry for components
 *   public/brand/abrahammoses-logo*.svg   corporate lockup, black and ivory
 *   public/brand/abrahammoses-mark*.svg   corporate "A" mark alone, black and ivory
 *   public/brand/abrahammoses-emblem*.svg the four-ring emblem, black and ivory
 *   src/app/icon.svg                  browser icon: the mark on a navy tile
 *   src/app/apple-icon.png            180×180 touch icon
 *   src/app/opengraph-image.png       1200×630 social preview
 *
 * Not generated here (committed from the brand kit, rendered from the same paths):
 *   src/app/favicon.ico (16/32/48; the 16px layer is hand-hinted so the mark stays
 *   legible), public/favicon-16x16.png, public/favicon-32x32.png,
 *   public/android-chrome-192x192.png, public/android-chrome-512x512.png,
 *   public/maskable-512x512.png.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const ROOT = join(import.meta.dirname, '../..');
const traced = JSON.parse(readFileSync(join(ROOT, 'design/brand/logo-paths.json'), 'utf8'));
const { emblem } = traced.parts;
const corporate = JSON.parse(readFileSync(join(ROOT, 'design/brand/corporate/logo-paths.json'), 'utf8'));
const { width: W, height: H, markWidth: MW, markHeight: MH } = corporate;
const { mark, wordmark } = corporate.parts;

const COLORS = { ink: '#000000', ivory: '#f4efe4', white: '#ffffff', navy: corporate.navy, midnight: '#0b1020', gold: '#c9a227', goldBright: '#e8c14f' };

// Emblem geometry, measured from the master: the hole of each ring and the centre of the star.
const EMBLEM_VIEWBOX = { width: 250, height: 268 };
const NODES = {
  top: { x: 126.3, y: 32.3 },
  right: { x: 217.2, y: 131.3 },
  bottom: { x: 124.1, y: 235.6 },
  left: { x: 32.4, y: 132.8 },
};
const CENTRE = { x: 124.6, y: 133.6 };
const RING_HOLE = 15.3;
const RING_OUTER = 24;

/** Split a path into its subpaths and find the small filled star at the centre. */
function sparklePath(d) {
  const subpaths = d.split(/(?=M)/);
  const candidates = subpaths
    .map((s) => {
      const nums = s.match(/-?\d+(\.\d+)?/g).map(Number);
      const xs = nums.filter((_, i) => i % 2 === 0);
      const ys = nums.filter((_, i) => i % 2 === 1);
      const box = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
      return { s, box, cx: (box.x0 + box.x1) / 2, cy: (box.y0 + box.y1) / 2, w: box.x1 - box.x0 };
    })
    .filter((c) => Math.hypot(c.cx - CENTRE.x, c.cy - CENTRE.y) < 8 && c.w < 50);
  if (candidates.length !== 1) throw new Error(`Expected one centre star, found ${candidates.length}`);
  return candidates[0].s;
}
const SPARKLE = sparklePath(emblem);

function logoSvg(fill, title = 'AbrahamMoses') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${title}"><title>${title}</title><g fill="${fill}"><path d="${mark}"/><path d="${wordmark}"/></g></svg>`;
}

function markSvg(fill, title = 'AbrahamMoses') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MW} ${MH}" width="${MW}" height="${MH}" role="img" aria-label="${title}"><title>${title}</title><path fill="${fill}" d="${mark}"/></svg>`;
}

function emblemSvg(fill, title = 'AbrahamMoses') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${EMBLEM_VIEWBOX.width} ${EMBLEM_VIEWBOX.height}" width="${EMBLEM_VIEWBOX.width}" height="${EMBLEM_VIEWBOX.height}" role="img" aria-label="${title}"><title>${title}</title><path fill="${fill}" fill-rule="evenodd" d="${emblem}"/></svg>\n`;
}

/**
 * Browser icon: the mark on a navy tile. The mark is a white rounded square with the "A" cut out;
 * the navy behind it fills the cut-outs, so the A reads on light and dark tabs alike. The tile is
 * inset slightly so no navy shows around the mark's rounded top corners.
 */
function iconSvg() {
  const S = MW;
  const i = S * 0.02;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="32" height="32"><rect x="${i}" y="${i}" width="${S - 2 * i}" height="${S - i}" rx="${S * 0.2}" fill="${COLORS.navy}"/><path fill="${COLORS.white}" d="${mark}"/></svg>`;
}

/** App icon: the mark centred on a full navy square, at `fraction` of the width. */
function appIconSvg(size, fraction) {
  const S = MW / fraction;
  const x = (MW - S) / 2;
  const y = (MH - S) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${S} ${S}" width="${size}" height="${size}" style="display:block"><rect x="${x}" y="${y}" width="${S}" height="${S}" fill="${COLORS.navy}"/><path fill="${COLORS.white}" d="${mark}"/></svg>`;
}

function write(rel, content) {
  writeFileSync(join(ROOT, rel), content);
  console.log(`wrote ${rel} (${Buffer.byteLength(content)} bytes)`);
}

write('public/brand/abrahammoses-logo.svg', logoSvg(COLORS.ink));
write('public/brand/abrahammoses-logo-ivory.svg', logoSvg(COLORS.ivory));
write('public/brand/abrahammoses-mark.svg', markSvg(COLORS.ink));
write('public/brand/abrahammoses-mark-ivory.svg', markSvg(COLORS.ivory));
write('public/brand/abrahammoses-emblem.svg', emblemSvg(COLORS.ink));
write('public/brand/abrahammoses-emblem-ivory.svg', emblemSvg(COLORS.ivory));
write('src/app/icon.svg', iconSvg());

write(
  'src/components/brand/paths.ts',
  `/**
 * Generated by scripts/brand/build-brand.mjs from design/brand/corporate/logo-paths.json
 * (the corporate logo) and design/brand/logo-paths.json (the four-ring emblem). Do not edit by hand.
 */

/** The corporate lockup: "A" mark and the two-line wordmark. */
export const LOGO_VIEWBOX = { width: ${W}, height: ${H} } as const;
export const MARK_VIEWBOX = { width: ${MW}, height: ${MH} } as const;
export const EMBLEM_VIEWBOX = ${JSON.stringify(EMBLEM_VIEWBOX)} as const;

/** The emblem: four rings joined through a four-pointed star. */
export const EMBLEM_PATH =
  '${emblem}';

/** The small filled star at the emblem's centre (also contained in EMBLEM_PATH). */
export const EMBLEM_SPARKLE_PATH =
  '${SPARKLE}';

/** Centres of the four ring holes and of the star, in emblem coordinates. */
export const EMBLEM_NODES = ${JSON.stringify(NODES)} as const;
export const EMBLEM_CENTRE = ${JSON.stringify(CENTRE)} as const;
export const EMBLEM_RING_HOLE = ${RING_HOLE};
export const EMBLEM_RING_OUTER = ${RING_OUTER};
`,
);

// Raster assets, rendered by Chromium from the same vectors.
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined),
});
async function render(html, width, height, rel) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.setContent(`<!doctype html><html><body style="margin:0">${html}</body></html>`);
  writeFileSync(join(ROOT, rel), await page.screenshot({ clip: { x: 0, y: 0, width, height } }));
  await page.close();
  console.log(`wrote ${rel} (${width}×${height})`);
}

await render(appIconSvg(180, 0.66), 180, 180, 'src/app/apple-icon.png');

const ogLogoWidth = 760;
await render(
  `<div style="width:1200px;height:630px;background:${COLORS.navy};display:flex;align-items:center;justify-content:center">
    <div style="width:${ogLogoWidth}px">${logoSvg(COLORS.white).replace('<svg ', '<svg style="display:block;width:100%;height:auto" ')}</div>
  </div>`,
  1200,
  630,
  'src/app/opengraph-image.png',
);

if (process.argv.includes('--check')) {
  // Render the logo white on navy at the master's scale, to compare with the master crop.
  const page = await browser.newPage({ viewport: { width: Math.ceil(W), height: Math.ceil(H) } });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:${COLORS.navy}">${logoSvg(COLORS.white).replace('<svg ', '<svg style="display:block" ')}</body></html>`);
  writeFileSync(join(ROOT, 'design/brand/.check-render.png'), await page.screenshot({ clip: { x: 0, y: 0, width: Math.ceil(W), height: Math.ceil(H) } }));
  console.log('wrote design/brand/.check-render.png — compare with the master crop', corporate.crop.join(','));
}

await browser.close();
