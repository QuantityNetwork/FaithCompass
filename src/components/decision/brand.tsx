/**
 * The official AbrahamMoses Decision Twin logo (traced from the owner's
 * artwork; public/brand/decision-twin). Used only for the Decision Twin
 * product, the Decision Room and Decision Passports; the AbrahamMoses logo
 * stays the site brand. Navy (#091121) on the light theme and in print,
 * ivory on the dark theme.
 */
const VIEWBOX = { width: 2382, height: 1382 };
const ALT = 'AbrahamMoses Decision Twin. Evidence Today. Wisdom Tomorrow.';

export function DecisionTwinLogo({ height, className }: { height: number; className?: string }) {
  const width = Math.round((height * VIEWBOX.width) / VIEWBOX.height);
  return (
    <span className={`dt-logo${className ? ` ${className}` : ''}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a static SVG needs no optimisation pipeline */}
      <img className="dt-logo__light" src="/brand/decision-twin/decision-twin-logo-navy.svg" alt={ALT} width={width} height={height} decoding="async" />
      {/* eslint-disable-next-line @next/next/no-img-element -- dark-theme rendering */}
      <img className="dt-logo__dark" src="/brand/decision-twin/decision-twin-logo-ivory.svg" alt={ALT} width={width} height={height} decoding="async" />
    </span>
  );
}
