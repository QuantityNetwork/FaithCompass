'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  EMBLEM_CENTRE,
  EMBLEM_NODES,
  EMBLEM_PATH,
  EMBLEM_RING_HOLE,
  EMBLEM_RING_OUTER,
  EMBLEM_SPARKLE_PATH,
} from './paths';

export type EmblemPosition = keyof typeof EMBLEM_NODES;

export type EmblemNode = {
  slug: string;
  position: EmblemPosition;
  /** Short label beside the ring, e.g. "Jewish". */
  short: string;
  /** Field of study, e.g. "Jewish studies". */
  field: string;
  question: string;
  href: string;
};

export type EmblemCentre = { href: string; title: string; detail: string };

type Props = {
  nodes: EmblemNode[];
  centre: EmblemCentre;
  /** The case whose worked answer is shown below. */
  selected?: string;
  intro: string;
};

/** Labels sit above the top ring and below the others, clear of the star's curves. */
const LABEL_OFFSET: Record<EmblemPosition, number> = {
  top: -(EMBLEM_RING_OUTER + 10),
  right: EMBLEM_RING_OUTER + 32,
  bottom: EMBLEM_RING_OUTER + 20,
  left: EMBLEM_RING_OUTER + 32,
};

/** From just outside a ring to the centre of the star. */
function armFrom(position: EmblemPosition) {
  const n = EMBLEM_NODES[position];
  const dx = EMBLEM_CENTRE.x - n.x;
  const dy = EMBLEM_CENTRE.y - n.y;
  const len = Math.hypot(dx, dy);
  return { x1: n.x + (dx / len) * EMBLEM_RING_OUTER, y1: n.y + (dy / len) * EMBLEM_RING_OUTER, x2: EMBLEM_CENTRE.x, y2: EMBLEM_CENTRE.y };
}

/**
 * The emblem as an introduction to the record.
 *
 * Its four rings are the four research cases, placed clockwise from the top in
 * the historical order of the traditions whose questions they are; the star
 * they all lead into is the shared record of sources. Each ring is a link to
 * its worked answer, so the figure works without JavaScript; with it, hovering
 * or focusing a ring (or the matching example question beside it) traces that
 * question back to the centre and names it in the caption.
 */
export function EmblemIntro({ nodes, centre, selected, intro }: Props) {
  const [active, setActive] = useState<string | null>(null);
  const current = nodes.find((n) => n.slug === active);

  // Keep the emblem and the example questions in step, in both directions.
  useEffect(() => {
    const examples = Array.from(document.querySelectorAll<HTMLElement>('.example[data-case]'));
    const cleanups = examples.map((el) => {
      const on = () => setActive(el.dataset.case ?? null);
      const off = () => setActive(null);
      el.addEventListener('mouseenter', on);
      el.addEventListener('focus', on);
      el.addEventListener('mouseleave', off);
      el.addEventListener('blur', off);
      return () => {
        el.removeEventListener('mouseenter', on);
        el.removeEventListener('focus', on);
        el.removeEventListener('mouseleave', off);
        el.removeEventListener('blur', off);
      };
    });
    return () => cleanups.forEach((c) => c());
  }, []);

  useEffect(() => {
    document.querySelectorAll<HTMLElement>('.example[data-case]').forEach((el) => {
      el.classList.toggle('is-lit', el.dataset.case === active);
    });
  }, [active]);

  const handlers = (key: string) => ({
    onMouseEnter: () => setActive(key),
    onMouseLeave: () => setActive(null),
    onFocus: () => setActive(key),
    onBlur: () => setActive(null),
  });

  return (
    <figure className={`emblem-intro${active ? ' has-active' : ''}`} aria-labelledby="emblem-intro-caption">
      <svg className="emblem-intro__svg" viewBox="-46 -24 342 316" role="group" aria-label="Four research questions, one record">
        <path className="emblem-mark" d={EMBLEM_PATH} fillRule="evenodd" aria-hidden="true" />

        {/* Played once on load: each ring lights in turn and traces itself to the centre. */}
        <g aria-hidden="true">
          {nodes.map((n, i) => {
            const p = EMBLEM_NODES[n.position];
            return (
              <g key={n.slug} style={{ ['--i' as string]: i }}>
                <circle className="emblem-play-fill" cx={p.x} cy={p.y} r={EMBLEM_RING_HOLE - 1.5} />
                <line className="emblem-play-arm" {...armFrom(n.position)} pathLength={1} />
              </g>
            );
          })}
          <path className="emblem-play-sparkle" d={EMBLEM_SPARKLE_PATH} />
        </g>

        {nodes.map((n) => {
          const p = EMBLEM_NODES[n.position];
          return (
            <Link
              key={n.slug}
              href={n.href}
              className={`emblem-node${active === n.slug ? ' is-active' : ''}${selected === n.slug ? ' is-selected' : ''}`}
              aria-label={`${n.field}: ${n.question}`}
              aria-current={selected === n.slug ? 'true' : undefined}
              {...handlers(n.slug)}
            >
              <line className="emblem-arm" {...armFrom(n.position)} pathLength={1} />
              <circle className="emblem-fill" cx={p.x} cy={p.y} r={EMBLEM_RING_HOLE - 1.5} />
              <circle className="emblem-focus" cx={p.x} cy={p.y} r={EMBLEM_RING_OUTER + 6} />
              <circle className="emblem-hit" cx={p.x} cy={p.y} r={EMBLEM_RING_OUTER + 8} />
              <text className="emblem-label" x={p.x} y={p.y + LABEL_OFFSET[n.position]} textAnchor="middle" aria-hidden="true">
                {n.short}
              </text>
            </Link>
          );
        })}

        <Link
          href={centre.href}
          className={`emblem-node emblem-node--centre${active === 'centre' ? ' is-active' : ''}`}
          aria-label={`${centre.title}: ${centre.detail}`}
          {...handlers('centre')}
        >
          <path className="emblem-sparkle" d={EMBLEM_SPARKLE_PATH} />
          <circle className="emblem-focus" cx={EMBLEM_CENTRE.x} cy={EMBLEM_CENTRE.y} r={30} />
          <circle className="emblem-hit" cx={EMBLEM_CENTRE.x} cy={EMBLEM_CENTRE.y} r={28} />
        </Link>
      </svg>

      <figcaption className="emblem-intro__caption" id="emblem-intro-caption">
        <span className="emblem-intro__eyebrow">{current ? current.field : active === 'centre' ? centre.title : 'Four traditions · one record'}</span>
        <span className="emblem-intro__text">{current ? current.question : active === 'centre' ? centre.detail : intro}</span>
      </figcaption>
    </figure>
  );
}
