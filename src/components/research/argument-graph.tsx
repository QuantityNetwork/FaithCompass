/**
 * The argument graph for a dossier, as a server-rendered SVG: premises and declared
 * assumptions on the left, the recorded derivations in the middle, the conclusions they
 * reach on the right. The Table view is its text alternative and is linked from here.
 */
import type { Outcomes } from '@/lib/research/dossier';
import type { AbrahamMosesRecord } from '@/lib/record/record';

const W = 790;
const ROW = 42;
const NODE_H = 34;
const COLS = [14, 330, 570];
const NODE_W = [270, 190, 206];

function clip(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

export function ArgumentGraph({
  record,
  derivations,
  out,
  inspectHref,
  tableHref,
}: {
  record: AbrahamMosesRecord;
  derivations: string[];
  out: Outcomes;
  inspectHref: (code: string) => string;
  tableHref: string;
}) {
  const ds = derivations.map((c) => record.data.derivations.find((d) => d.code === c)!).filter(Boolean);
  if (!ds.length) {
    return (
      <p className="notice">
        No argument structure is recorded for the claims in this view, so there is no graph to draw. The{' '}
        <a className="link" href={tableHref}>
          table
        </a>{' '}
        lists every record.
      </p>
    );
  }
  // One band per derivation: its premises and assumptions on the left, the derivation in
  // the middle, its conclusion on the right. A record used by several derivations is drawn
  // in each band, so no edge crosses another band.
  type Band = { d: (typeof ds)[number]; top: number; left: Array<{ id: string; kind: 'claim' | 'axiom'; y: number; necessary: boolean }>; mid: number };
  const bands: Band[] = [];
  let top = 20;
  for (const d of ds) {
    const items = [
      ...d.premises.map((p) => ({ id: p.claim, kind: 'claim' as const, necessary: p.necessity === 'necessary' })),
      ...d.axioms.map((a) => ({ id: a.axiom, kind: 'axiom' as const, necessary: a.role === 'requires' })),
    ];
    const n = Math.max(items.length, 1);
    const left = items.map((it, i) => ({ ...it, y: top + i * ROW }));
    bands.push({ d, top, left, mid: top + ((n - 1) * ROW) / 2 });
    top += n * ROW + 22;
  }
  const H = top;
  const failing = (code: string) => out.claim(code) === 'not_established' || out.claim(code) === 'support_weakened';
  const leftCount = new Set(bands.flatMap((b) => b.left.map((l) => l.id))).size;
  const right = new Set(ds.map((d) => d.claim));
  return (
    <figure className="rw-graph">
      <div className="rw-graph__scroll">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          role="group"
          aria-label={`Argument graph: ${leftCount} premises and assumptions, ${ds.length} derivations, ${right.size} conclusions. A table with the same content is available.`}
        >
          {bands.map(({ d, top: bt, left, mid }, bi) => (
            <g key={d.code} className="rw-graph__band">
              {bi ? <line className="rw-graph__sep" x1={0} x2={W} y1={bt - 12} y2={bt - 12} aria-hidden="true" /> : null}
              <g aria-hidden="true">
                {left.map((l) => (
                  <path
                    key={`${l.kind}-${l.id}`}
                    className={l.kind === 'axiom' ? 'e-ax' : l.necessary ? 'e-nec' : 'e-sup'}
                    d={`M${COLS[0] + NODE_W[0]},${l.y + NODE_H / 2} C${COLS[1] - 40},${l.y + NODE_H / 2} ${COLS[1] - 60},${mid + NODE_H / 2} ${COLS[1]},${mid + NODE_H / 2}`}
                  />
                ))}
                <path className={out.derivationValid(d.code) ? 'e-nec' : 'e-fail'} d={`M${COLS[1] + NODE_W[1]},${mid + NODE_H / 2} L${COLS[2]},${mid + NODE_H / 2}`} />
              </g>
              {left.map((n) => {
                const label = n.kind === 'claim' ? (record.claim(n.id)?.topic ?? '') : (record.axiom(n.id)?.label ?? '');
                return (
                  <a key={`${n.kind}-${n.id}`} href={n.kind === 'claim' ? inspectHref(n.id) : `/hermeneutics#${n.id}`} aria-label={`${n.kind === 'claim' ? 'Premise' : 'Assumption'} ${n.id}: ${label}`}>
                    <g className={`n n--${n.kind}${n.kind === 'claim' && failing(n.id) ? ' n--fail' : ''}`} transform={`translate(${COLS[0]},${n.y})`}>
                      <rect width={NODE_W[0]} height={NODE_H} />
                      <text x={10} y={14} className="n__code">
                        {n.id.replace('AM-CLAIM-000', 'CLAIM ')}
                      </text>
                      <text x={10} y={27} className="n__label">
                        {clip(label, 40)}
                      </text>
                    </g>
                  </a>
                );
              })}
              <g className={`n n--der${out.derivationValid(d.code) ? '' : ' n--fail'}`} transform={`translate(${COLS[1]},${mid})`}>
                <rect width={NODE_W[1]} height={NODE_H} />
                <text x={10} y={14} className="n__code">
                  {d.code}
                </text>
                <text x={10} y={27} className="n__label">
                  {clip(d.label, 28)}
                </text>
              </g>
              <a href={inspectHref(d.claim)} aria-label={`Conclusion ${d.claim}: ${record.claim(d.claim)?.topic ?? ''}`}>
                <g className={`n n--concl${failing(d.claim) ? ' n--fail' : ''}`} transform={`translate(${COLS[2]},${mid})`}>
                  <rect width={NODE_W[2]} height={NODE_H} />
                  <text x={10} y={14} className="n__code">
                    {d.claim.replace('AM-CLAIM-000', 'CLAIM ')}
                  </text>
                  <text x={10} y={27} className="n__label">
                    {clip(record.claim(d.claim)?.topic ?? '', 30)}
                  </text>
                </g>
              </a>
            </g>
          ))}
        </svg>
      </div>
      <figcaption className="rw-graph__key">
        <span>
          <i className="k k--nec" aria-hidden="true" /> necessary premise
        </span>
        <span>
          <i className="k k--sup" aria-hidden="true" /> supporting premise
        </span>
        <span>
          <i className="k k--ax" aria-hidden="true" /> declared assumption
        </span>
        <span>
          <i className="k k--fail" aria-hidden="true" /> fails under the selected assumptions
        </span>
        <a className="link" href={tableHref}>
          Same content as a table
        </a>
      </figcaption>
    </figure>
  );
}
