/** Shared page parts for the Decision Passport section. */
import type { ReactNode } from 'react';

export const DISCLAIMER =
  'A passport attests to process and evidence integrity, not legal correctness. It is not legal advice, not a qualified electronic signature or seal, and not a certification; no regulatory approval is claimed.';

export function Intro({ kicker, title, children }: { kicker: string; title: string; children: ReactNode }) {
  return (
    <div className="dp-intro">
      <div>
        <p className="dp-kicker">{kicker}</p>
        <h1>{title}</h1>
      </div>
      <div>{children}</div>
    </div>
  );
}

export function Section({ n, id, title, lede, children }: { n: number | string; id: string; title: string; lede?: string; children: ReactNode }) {
  return (
    <section className="dp-section" id={id} aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`}>
        <span className="dp-num">{n}.</span>
        {title}
      </h2>
      {lede ? <p className="dp-lede">{lede}</p> : null}
      {children}
    </section>
  );
}

export function Disclaimer() {
  return (
    <p className="dp-disclaimer">
      <strong>Disclaimer.</strong> {DISCLAIMER}
    </p>
  );
}

export const GITHUB = 'https://github.com/QuantityNetwork/FaithCompass/blob/claude/abrahammoses-research-instrument';
export const GITHUB_TREE = 'https://github.com/QuantityNetwork/FaithCompass/tree/claude/abrahammoses-research-instrument';
