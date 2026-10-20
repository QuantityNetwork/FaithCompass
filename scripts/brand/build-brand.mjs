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
 *   public/brand/abrahammoses-logo*.svg   primary logo: the mark and the one-line "AbrahamMoses"
 *                                         wordmark (composed below from the traced two-line wordmark),
 *                                         black and ivory
 *   public/brand/abrahammoses-logo-stacked*.svg  the original two-line lockup, black and ivory
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

/*
 * The one-line wordmark and horizontal lockup, composed from the traced letterforms rather than
 * retyped: "Moses" moves onto the baseline of "Abraham", the capital M marking the word break.
 *   - Lines: subpaths of the wordmark above and below its vertical middle.
 *   - Baseline of a line: the lowest bottom among its flat-footed letters, i.e. the minimum of the
 *     outer contours' bottoms (round letters overshoot below it).
 *   - m–M gap: 19 units, the a–m gap in the master (the widest gap between straight-sided letters).
 *   - Lockup: the mark at 1.7× the wordmark's height (ascender to baseline), centred on it, half that
 *     height away. The same geometry is in the brand kit (abrahammoses-lockup-horizontal-*).
 */
const WORD_GAP = 19;
const MARK_TO_TEXT = 1.7;
const MARK_GAP = 0.5;
const NUM = /-?\d+(?:\.\d+)?/g;
const boxOf = (d) => {
  const n = (d.match(NUM) ?? []).map(Number);
  const xs = n.filter((_, i) => i % 2 === 0);
  const ys = n.filter((_, i) => i % 2 === 1);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
};
const moved = (d, scale, tx, ty) => {
  let i = 0;
  return d.replace(NUM, (v) => (Number(v) * scale + (i++ % 2 === 0 ? tx : ty)).toFixed(2).replace(/\.?0+$/, ''));
};
function composeOneLine() {
  const subs = wordmark.split(/(?=M)/).map((x) => x.trim()).filter(Boolean).map((d) => ({ d, b: boxOf(d) }));
  const all = boxOf(wordmark);
  const mid = (all.y0 + all.y1) / 2;
  const inside = (a, b) => a !== b && a.b.x0 >= b.b.x0 && a.b.x1 <= b.b.x1 && a.b.y0 >= b.b.y0 && a.b.y1 <= b.b.y1;
  const line = (top) => {
    const ps = subs.filter((p) => (p.b.y0 < mid) === top);
    const outer = ps.filter((p) => !ps.some((q) => inside(p, q)));
    return {
      ps,
      x0: Math.min(...ps.map((p) => p.b.x0)),
      x1: Math.max(...ps.map((p) => p.b.x1)),
      top: Math.min(...ps.map((p) => p.b.y0)),
      baseline: Math.min(...outer.map((p) => p.b.y1)),
    };
  };
  const [a, m] = [line(true), line(false)];
  const dx = a.x1 + WORD_GAP - m.x0;
  const dy = a.baseline - m.baseline;
  const joined = [...a.ps.map((p) => p.d), ...m.ps.map((p) => moved(p.d, 1, dx, dy))].join(' ');
  const b = boxOf(joined);
  const word = moved(joined, 1, -b.x0, -a.top);
  const wordW = b.x1 - b.x0;
  const textH = a.baseline - a.top; // ascender to baseline
  const wordH = b.y1 - a.top; // includes the round letters' overshoot
  const s = (MARK_TO_TEXT * textH) / MH;
  const markY = textH / 2 - (MH * s) / 2;
  const textX = MW * s + MARK_GAP * textH;
  return {
    word,
    wordW,
    wordH,
    lockup: { mark: moved(mark, s, 0, 0), word: moved(word, 1, textX, -markY), width: textX + wordW, height: Math.max(MH * s, wordH - markY) },
  };
}
const ONE = composeOneLine();
const r2 = (v) => Math.round(v * 100) / 100;
const HW = r2(ONE.lockup.width);
const HH = r2(ONE.lockup.height);

function logoSvg(fill, title = 'AbrahamMoses') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${HW} ${HH}" width="${HW}" height="${HH}" role="img" aria-label="${title}"><title>${title}</title><g fill="${fill}"><path d="${ONE.lockup.mark}"/><path d="${ONE.lockup.word}"/></g></svg>`;
}

function wordmarkSvg(fill, title = 'AbrahamMoses') {
  const w = r2(ONE.wordW), h = r2(ONE.wordH);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${title}"><title>${title}</title><path fill="${fill}" d="${ONE.word}"/></svg>`;
}

function stackedSvg(fill, title = 'AbrahamMoses') {
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
write('public/brand/abrahammoses-logo-stacked.svg', stackedSvg(COLORS.ink));
write('public/brand/abrahammoses-logo-stacked-ivory.svg', stackedSvg(COLORS.ivory));
write('public/brand/abrahammoses-wordmark.svg', wordmarkSvg(COLORS.ink));
write('public/brand/abrahammoses-wordmark-ivory.svg', wordmarkSvg(COLORS.ivory));
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

/** The primary logo: the "A" mark and the one-line "AbrahamMoses" wordmark. */
export const LOGO_VIEWBOX = { width: ${HW}, height: ${HH} } as const;
/** The secondary, stacked lockup: the mark and the two-line wordmark, as traced. */
export const STACKED_LOGO_VIEWBOX = { width: ${W}, height: ${H} } as const;
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
    <div style="width:${ogLogoWidth}px">${stackedSvg(COLORS.white).replace('<svg ', '<svg style="display:block;width:100%;height:auto" ')}</div>
  </div>`,
  1200,
  630,
  'src/app/opengraph-image.png',
);

if (process.argv.includes('--check')) {
  // Render the logo white on navy at the master's scale, to compare with the master crop.
  const page = await browser.newPage({ viewport: { width: Math.ceil(W), height: Math.ceil(H) } });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:${COLORS.navy}">${stackedSvg(COLORS.white).replace('<svg ', '<svg style="display:block" ')}</body></html>`);
  writeFileSync(join(ROOT, 'design/brand/.check-render.png'), await page.screenshot({ clip: { x: 0, y: 0, width: Math.ceil(W), height: Math.ceil(H) } }));
  console.log('wrote design/brand/.check-render.png — compare with the master crop', corporate.crop.join(','));
}

await browser.close();
