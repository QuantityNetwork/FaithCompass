/**
 * Script typefaces, self-hosted through next/font (downloaded at build time and served
 * from this origin; no request reaches Google from a reader's browser).
 *
 * Latin text uses the production stacks (system serif for reading and headings, system
 * sans for labels and data), exactly as on the live site, so nothing is preloaded.
 * - Noto Serif: polytonic Greek (greek, greek-ext).
 * - Noto Serif Hebrew, Noto Naskh Arabic, Noto Sans Syriac: original-language passages.
 * Each carries a unicode-range, so a browser downloads it only when a page contains that script.
 */
import { Noto_Naskh_Arabic, Noto_Sans_Syriac, Noto_Serif, Noto_Serif_Hebrew } from 'next/font/google';

export const notoSerifGreek = Noto_Serif({
  subsets: ['greek', 'greek-ext'],
  weight: ['400', '600'],
  display: 'swap',
  preload: false,
  variable: '--font-greek',
});

export const notoSerifHebrew = Noto_Serif_Hebrew({
  subsets: ['hebrew'],
  weight: ['400', '600'],
  display: 'swap',
  preload: false,
  variable: '--font-hebrew',
});

export const notoNaskhArabic = Noto_Naskh_Arabic({
  subsets: ['arabic'],
  weight: ['400', '600'],
  display: 'swap',
  preload: false,
  variable: '--font-arabic',
});

export const notoSansSyriac = Noto_Sans_Syriac({
  subsets: ['syriac'],
  weight: ['400'],
  display: 'swap',
  preload: false,
  variable: '--font-syriac',
});

export const FONT_VARIABLES = [notoSerifGreek, notoSerifHebrew, notoNaskhArabic, notoSansSyriac]
  .map((f) => f.variable)
  .join(' ');
