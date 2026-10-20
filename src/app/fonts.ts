/**
 * Script typefaces, self-hosted from /public/fonts (SIL OFL 1.1, see public/fonts/LICENSES.md). The files and
 * @font-face rules (src/app/fonts.css) are exactly what next/font/google generated for this configuration, committed
 * so that builds never fetch from Google:
 *
 * Design D (warm scholarly-minimal): Figtree (variable 300–900, latin + latin-ext) for UI, headings and body;
 * Newsreader 400 roman and italic for quotations, statements, numerals and italic emphasis. Figtree latin is
 * preloaded; everything else loads on first use through its unicode-range.
 * - Noto Serif 400/600: polytonic Greek (greek, greek-ext).
 * - Noto Serif Hebrew 400/600, Noto Naskh Arabic 400/600, Noto Sans Syriac 400: original-language passages.
 * Each family has a metric-adjusted local fallback (size-adjust, ascent/descent overrides) to limit layout shift.
 */

/** Classes that define --font-figtree, --font-newsreader, --font-greek, --font-hebrew, --font-arabic, --font-syriac. */
export const FONT_VARIABLES = ['figtree', 'newsreader', 'greek', 'hebrew', 'arabic', 'syriac'].map((n) => `am-font-${n}`).join(' ');

/** Figtree latin, preloaded as next/font did. */
export const PRELOAD_FONTS = ['/fonts/de42cfb9a3b980ae-s.p.woff2'];
