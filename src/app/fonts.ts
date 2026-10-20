/**
 * Script typefaces, self-hosted through next/font (downloaded at build time and served
 * from this origin; no request reaches Google from a reader's browser).
 *
 * Design D (warm scholarly-minimal): Figtree for UI, headings and body; Newsreader for
 * quotations, statements, numerals and italic emphasis. Figtree is preloaded (latin only); Newsreader loads on first use.
 * - Noto Serif: polytonic Greek (greek, greek-ext).
 * - Noto Serif Hebrew, Noto Naskh Arabic, Noto Sans Syriac: original-language passages.
 * Each carries a unicode-range, so a browser downloads it only when a page contains that script.
 */
import { Figtree, Newsreader, Noto_Naskh_Arabic, Noto_Sans_Syriac, Noto_Serif, Noto_Serif_Hebrew } from 'next/font/google';

export const figtree = Figtree({
  // Variable font: one file covers 400–700. Only the latin subset is preloaded; latin-ext
  // (ā, ī, ḥ in transliterations) loads on demand through its unicode-range.
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-figtree',
});

export const newsreader = Newsreader({
  // Static 400 roman and italic: much smaller than the variable font with its optical-size axis.
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
  display: 'swap',
  preload: false,
  variable: '--font-newsreader',
});

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

export const FONT_VARIABLES = [figtree, newsreader, notoSerifGreek, notoSerifHebrew, notoNaskhArabic, notoSansSyriac]
  .map((f) => f.variable)
  .join(' ');
