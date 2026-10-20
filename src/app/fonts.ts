/**
 * Typefaces, self-hosted through next/font (downloaded at build time and served
 * from this origin; no request reaches Google from a reader's browser).
 *
 * - Montserrat: interface text (navigation, labels, data). The brand face.
 * - Source Serif 4: reading text and headings.
 * - Noto Serif: polytonic Greek (greek, greek-ext).
 * - Noto Serif Hebrew, Noto Naskh Arabic, Noto Sans Syriac: original-language passages.
 *
 * Only the latin subset of the two faces every page uses is preloaded (Lighthouse mobile:
 * 83 with three static weights per face and latin-ext preloaded, 91 with latin-ext, 93-94 now).
 * Every other subset and script face carries a unicode-range, so a browser downloads them only when a page contains that script.
 */
import { Montserrat, Noto_Naskh_Arabic, Noto_Sans_Syriac, Noto_Serif, Noto_Serif_Hebrew, Source_Serif_4 } from 'next/font/google';

// Variable fonts (one file per style). Only the latin subset is preloaded; latin-ext
// (transliterations such as ā, ḥ, ʿ) is declared with its unicode-range and fetched on use.
export const montserrat = Montserrat({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-montserrat',
});

export const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  // Upright only: italics are rare in the record (no italic on the home page), and a second
  // preloaded file cost more than it gave on mobile. Browsers synthesise the few italics.
  style: ['normal'],
  display: 'swap',
  variable: '--font-source-serif',
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

export const FONT_VARIABLES = [montserrat, sourceSerif, notoSerifGreek, notoSerifHebrew, notoNaskhArabic, notoSansSyriac]
  .map((f) => f.variable)
  .join(' ');
