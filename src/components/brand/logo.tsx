import { LOGO_VIEWBOX } from './paths';

/**
 * The AbrahamMoses logo (the "A" mark and the one-line wordmark; the stacked
 * two-line lockup is in public/brand/abrahammoses-logo-stacked*.svg),
 * served as a cached SVG file rather than inlined: the wordmark's outlines are
 * about 20 KB, which every page would otherwise repeat. The site is dark-only,
 * so the ivory rendering is the default.
 */
export function Logo({ height, tone = 'ivory', className }: { height: number; tone?: 'ivory' | 'ink'; className?: string }) {
  const width = Math.round((height * LOGO_VIEWBOX.width) / LOGO_VIEWBOX.height);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a static SVG needs no optimisation pipeline
    <img
      src={tone === 'ivory' ? '/brand/abrahammoses-logo-ivory.svg' : '/brand/abrahammoses-logo.svg'}
      alt="AbrahamMoses"
      width={width}
      height={height}
      className={className}
      decoding="async"
    />
  );
}
