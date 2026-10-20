'use client';

/**
 * Hermeneutical Dependency Explorer.
 *
 * A reader rejects a reading principle or a claim and watches the record's
 * actual dependency graph recalculate — in the browser, with the same engine
 * the API and MCP server run. Nothing is edited: the explorer only ever holds
 * a simulation, and it shows rival positions on both sides so that rejecting
 * one assumption never looks like the disagreement has gone away.
 *
 * Progressive enhancement: the server renders the explorer for the state in
 * the URL (?reject=…&lens=…), every toggle is a real link to that state, and
 * with JavaScript the same links update in place without a round trip.
 */

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { COUNTER_STATUS_LABELS, EDGE_STATUS_LABELS, STATUS_DESCRIPTIONS, STATUS_LABELS, STATUS_SHORT_LABELS, simulate, type ClaimStatus, type DependencyGraph } from '@/lib/record/engine';
import { explain, lookupFor } from '@/lib/record/explain';
import { NODE_H, NODE_W, layoutGraph } from '@/lib/record/layout';

export interface ExplorerProps {
  graph: DependencyGraph;
  /** Claims drawn in the graph. */
  scope: string[];
  basePath: string;
  initial: { reject: string[]; lens: string | null };
  traditions: Array<{ id: string; name: string }>;
  positions?: Array<{ claim: string; label: string; heldBy: string[] }>;
  featured?: [string, string];
  suggested?: string;
  counterModels: Record<string, { title: string; heldBy: string }>;
  edgeLabels: Record<string, string>;
  traditionNames: Record<string, string>;
}

const STROKE: Record<ClaimStatus, { stroke: string; dash?: string; width: number }> = {
  stands: { stroke: 'var(--rule-strong)', width: 1.2 },
  weakened: { stroke: 'var(--status-weakened)', dash: '6 4', width: 1.6 },
  unwarranted: { stroke: 'var(--status-unwarranted)', dash: '2 3', width: 1.8 },
  broken: { stroke: 'var(--status-broken)', width: 2.4 },
  rejected: { stroke: 'var(--status-broken)', width: 3.2 },
};

/** basePath may carry its own query (e.g. ?scope=…), which is kept. */
function hrefFor(basePath: string, reject: string[], lens: string | null) {
  const [path, existing] = basePath.split('?');
  const params = new URLSearchParams(existing);
  params.delete('reject');
  params.delete('lens');
  if (reject.length) params.set('reject', reject.join(','));
  if (lens) params.set('lens', lens);
  const qs = params.toString();
  return `${path}${qs ? `?${qs}` : ''}#explorer`;
}

function shortCode(code: string) {
  return code.replace('AM-CLAIM-000', 'Claim ').replace('AM-AX-', 'Axiom ');
}

export function DependencyExplorer(props: ExplorerProps) {
  const { graph, scope, basePath, traditions, positions, featured, suggested, counterModels, edgeLabels, traditionNames } = props;
  const [reject, setReject] = useState<string[]>(props.initial.reject);
  const [lens, setLens] = useState<string | null>(props.initial.lens);
  const [selected, setSelected] = useState<string | null>(null);

  const lookup = useMemo(() => lookupFor(graph), [graph]);
  const layout = useMemo(() => layoutGraph(graph, scope), [graph, scope]);
  const result = useMemo(
    () =>
      simulate(graph, {
        rejectClaims: reject.filter((c) => c.startsWith('AM-CLAIM-')),
        rejectAxioms: reject.filter((c) => c.startsWith('AM-AX-')),
        lens,
      }),
    [graph, reject, lens],
  );

  const inScope = useMemo(() => new Set(scope), [scope]);
  const scopeAxioms = useMemo(
    () =>
      [...new Set(graph.derivations.filter((d) => inScope.has(d.claim)).flatMap((d) => d.axioms.map((a) => a.axiom)))]
        .sort()
        .map((code) => graph.axioms.find((a) => a.code === code)!),
    [graph, inScope],
  );

  // Keep the URL shareable without a navigation.
  useEffect(() => {
    const url = hrefFor(basePath, reject, lens).replace('#explorer', '');
    window.history.replaceState(null, '', url + window.location.hash);
  }, [basePath, reject, lens]);

  const toggle = useCallback((code: string) => {
    setReject((r) => (r.includes(code) ? r.filter((c) => c !== code) : [...r, code].sort()));
  }, []);

  const toggleNext = (code: string) => (reject.includes(code) ? reject.filter((c) => c !== code) : [...reject, code].sort());

  const onLinkToggle = (code: string) => (e: MouseEvent) => {
    e.preventDefault();
    toggle(code);
  };
  const onSpace = (code: string) => (e: KeyboardEvent) => {
    if (e.key === ' ') {
      e.preventDefault();
      toggle(code);
    }
  };

  const lensAxioms = result.effectiveAxioms.filter((a) => !reject.includes(a));
  const affectedInScope = result.affected.filter((a) => inScope.has(a.code) || positions?.some((p) => p.claim === a.code));
  const nothingRejected = reject.length === 0 && !lens;

  const summary = nothingRejected
    ? 'Nothing set aside. Every claim in the record is supported by at least one derivation under the full set of assumptions.'
    : `Rejected ${[...reject, ...lensAxioms].join(', ')}${lens ? ` (lens: ${traditionNames[lens] ?? lens})` : ''}. ` +
      `${result.summary.broken} not established under the selected assumptions, ${result.summary.unwarranted} partially supported, ${result.summary.weakened} with support weakened; ` +
      `${result.summary.edgesUngrounded} map connections not established, ${result.summary.edgesWeakened} with support weakened. No source was changed.`;

  const selectedStatus = selected ? (result.statuses[selected] ?? null) : null;
  const selectedOutcome = selected ? result.affected.find((a) => a.code === selected) : undefined;
  const selectedDerivations = selected ? graph.derivations.filter((d) => d.claim === selected) : [];
  const selectedClaim = selected ? graph.claims.find((c) => c.code === selected) : undefined;
  const selectedAxiom = selected ? graph.axioms.find((a) => a.code === selected) : undefined;

  return (
    <section className="explorer" id="explorer" aria-label="Dependency Explorer">
      <div className="explorer__bar">
        <p className="explorer__summary" role="status" aria-live="polite" style={{ margin: 0 }}>
          {summary}
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <a
            className="button button--quiet"
            href={hrefFor(basePath, [], null)}
            onClick={(e) => {
              e.preventDefault();
              setReject([]);
              setLens(null);
            }}
          >
            Reset
          </a>
          <a className="button button--quiet" href={`/api/v1/simulate?${new URLSearchParams({
            ...(reject.some((c) => c.startsWith('AM-CLAIM-')) ? { reject_claims: reject.filter((c) => c.startsWith('AM-CLAIM-')).join(',') } : {}),
            ...(reject.some((c) => c.startsWith('AM-AX-')) ? { reject_axioms: reject.filter((c) => c.startsWith('AM-AX-')).join(',') } : {}),
            ...(lens ? { lens } : {}),
          }).toString()}`}>
            As JSON
          </a>
        </div>
      </div>

      <div className="explorer__grid">
        <div className="explorer__controls">
          <div className="explorer__group-title" style={{ marginTop: 0 }}>
            Reading principles
          </div>
          <p className="small faint" style={{ marginTop: 0 }}>
            Reject an assumption to see what rests on it.
          </p>
          {scopeAxioms.map((a) => {
            const pressed = reject.includes(a.code);
            const viaLens = lensAxioms.includes(a.code);
            return (
              <a
                key={a.code}
                role="button"
                aria-pressed={pressed}
                className="toggle"
                href={hrefFor(basePath, toggleNext(a.code), lens)}
                onClick={onLinkToggle(a.code)}
                onKeyDown={onSpace(a.code)}
              >
                <span className="toggle__box" aria-hidden="true" />
                <span>
                  <span className="toggle__code">{a.code}</span>
                  {a.label}
                  <span className="toggle__code">{a.heldBy}</span>
                  {suggested === a.code && !pressed ? <span className="toggle__suggested">Try this first</span> : null}
                  {viaLens ? <span className="toggle__suggested">Removed by the lens</span> : null}
                </span>
              </a>
            );
          })}

          <label className="explorer__group-title" htmlFor="lens-select" style={{ display: 'block' }}>
            Read through a tradition’s lens
          </label>
          <select
            id="lens-select"
            className="explorer__select"
            value={lens ?? ''}
            onChange={(e) => setLens(e.target.value || null)}
          >
            <option value="">No lens</option>
            {traditions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <p className="small faint">
            A lens removes the principles a tradition rejects or sets aside. Principles it does not address stay in place.
          </p>

          {reject.some((c) => c.startsWith('AM-CLAIM-')) ? (
            <>
              <div className="explorer__group-title">Rejected claims</div>
              {reject
                .filter((c) => c.startsWith('AM-CLAIM-'))
                .map((c) => (
                  <a
                    key={c}
                    role="button"
                    aria-pressed="true"
                    className="toggle"
                    href={hrefFor(basePath, toggleNext(c), lens)}
                    onClick={onLinkToggle(c)}
                    onKeyDown={onSpace(c)}
                  >
                    <span className="toggle__box" aria-hidden="true" />
                    <span>
                      <span className="toggle__code">{c}</span>
                      Restore
                    </span>
                  </a>
                ))}
            </>
          ) : (
            <p className="small faint" style={{ marginTop: 18 }}>
              To reject a claim, select it in the graph.
            </p>
          )}
        </div>

        <div className="explorer__main">
          {positions && positions.length > 0 ? (
            <>
              <h3 className="subheading">Positions</h3>
              <div className="positions" style={{ marginBottom: 22 }}>
                {[...positions]
                  .sort((a, b) => Number(featured?.includes(b.claim)) - Number(featured?.includes(a.claim)))
                  .map((p) => {
                    const status = result.statuses[p.claim];
                    const ds = graph.derivations.filter((d) => d.claim === p.claim);
                    return (
                      <div key={p.claim} className={`position position--${status}`}>
                        <div className="claim-card__head">
                          <span className="code-inline">{p.claim}</span>
                          <span className={`status status--${status}`}>{STATUS_LABELS[status]}</span>
                          {featured?.includes(p.claim) ? <span className="pill">Featured</span> : null}
                        </div>
                        <p style={{ margin: '8px 0 4px', color: 'var(--ink-strong)' }}>{p.label}</p>
                        <p className="small muted" style={{ margin: 0 }}>
                          {lookup.claim(p.claim)}
                        </p>
                        <ul className="reasons-plain">
                          {ds.map((d) => (
                            <li key={d.code}>
                              {result.derivations[d.code].valid ? 'Holds' : 'Fails'}: {d.label}
                            </li>
                          ))}
                        </ul>
                        <p className="position__held">Held by {p.heldBy.map((t) => traditionNames[t] ?? t).join(', ')}</p>
                      </div>
                    );
                  })}
              </div>
            </>
          ) : null}

          <h3 className="subheading">Dependency graph</h3>
          <p className="small faint" style={{ marginTop: 0 }}>
            Arrows run from what a claim rests on to the claim. Solid: necessary or required. Dashed: supporting or
            strengthening. Select a box to inspect it; use Tab and Enter to move through the graph.
          </p>
          <div className="graph-wrap">
            <svg
              viewBox={`0 0 ${layout.width} ${layout.height}`}
              width={layout.width}
              style={{ display: 'block', minWidth: Math.min(layout.width, 640), width: '100%', height: 'auto' }}
              role="group"
              aria-label={`Dependency graph of ${layout.nodes.length} claims and principles`}
            >
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" style={{ fill: 'var(--ink-faint)' }} />
                </marker>
                <marker id="arrow-hot" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" style={{ fill: 'var(--status-broken)' }} />
                </marker>
              </defs>
              {layout.edges.map((e, i) => {
                const failed = !result.derivations[e.derivation]?.valid;
                const source = e.from.startsWith('AM-AX-') ? (result.effectiveAxioms.includes(e.from) ? 'rejected' : 'stands') : result.statuses[e.from];
                const hot = source !== 'stands' && failed;
                const axiomEdge = e.kind === 'requires' || e.kind === 'strengthened_by';
                return (
                  <path
                    key={i}
                    d={e.d}
                    fill="none"
                    style={{ stroke: hot ? 'var(--status-broken)' : axiomEdge ? 'var(--gold-dim)' : 'var(--ink-faint)' }}
                    strokeWidth={e.kind === 'necessary' || e.kind === 'requires' ? 1.4 : 1}
                    strokeDasharray={e.kind === 'supporting' || e.kind === 'strengthened_by' ? '5 4' : undefined}
                    markerEnd={hot ? 'url(#arrow-hot)' : 'url(#arrow)'}
                    opacity={source === 'stands' && !failed ? 0.55 : 0.95}
                  />
                );
              })}
              {layout.nodes.map((n) => {
                const status: ClaimStatus =
                  n.kind === 'axiom' ? (result.effectiveAxioms.includes(n.id) ? 'rejected' : 'stands') : result.statuses[n.id];
                const s = STROKE[status];
                const isSelected = selected === n.id;
                const label = `${n.id}, ${STATUS_LABELS[status]}: ${n.title}`;
                return (
                  <g
                    key={n.id}
                    className={`graph-node${isSelected ? ' graph-node--selected' : ''}`}
                    role="button"
                    tabIndex={0}
                    aria-label={label}
                    aria-pressed={isSelected}
                    onClick={() => setSelected(isSelected ? null : n.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelected(isSelected ? null : n.id);
                      }
                    }}
                  >
                    <title>{label}</title>
                    <rect
                      className="graph-node__plate"
                      x={n.x}
                      y={n.y}
                      width={NODE_W}
                      height={NODE_H}
                      rx={n.kind === 'axiom' ? 18 : 2}
                      style={{
                        fill: status === 'rejected' ? 'rgba(216,160,144,0.12)' : n.kind === 'axiom' ? 'var(--ground-inset)' : 'var(--ground-raised)',
                        stroke: s.stroke,
                      }}
                      strokeWidth={n.role === 'position' ? s.width + 0.8 : s.width}
                      strokeDasharray={s.dash}
                    />
                    <text x={n.x + 12} y={n.y + 17} fontSize="10.5" letterSpacing="0.06em" style={{ fontFamily: 'var(--sans)', fill: status === 'stands' ? 'var(--ink-faint)' : s.stroke }}>
                      {shortCode(n.id).toUpperCase()}
                      {n.role === 'position' ? ' · POSITION' : ''}
                      {status !== 'stands' ? ` · ${STATUS_SHORT_LABELS[status].toUpperCase()}` : ''}
                    </text>
                    {n.lines.map((line, i) => (
                      <text key={i} x={n.x + 12} y={n.y + 35 + i * 15} fontSize="12.5" textDecoration={status === 'broken' || status === 'rejected' ? 'line-through' : undefined} style={{ fontFamily: 'var(--serif)', fill: 'var(--ink)' }}>
                        {line}
                      </text>
                    ))}
                  </g>
                );
              })}
            </svg>
          </div>
          <div className="legend" aria-hidden="true">
            <span>
              <i className="swatch" /> {STATUS_LABELS.stands}
            </span>
            <span>
              <i className="swatch swatch--weakened" /> {STATUS_LABELS.weakened}
            </span>
            <span>
              <i className="swatch swatch--unwarranted" /> {STATUS_LABELS.unwarranted}
            </span>
            <span>
              <i className="swatch swatch--broken" /> {STATUS_LABELS.broken}
            </span>
            <span>
              <i className="swatch swatch--rejected" /> {STATUS_LABELS.rejected}
            </span>
          </div>

          {selected ? (
            <div className="inspector" aria-live="polite">
              <div className="claim-card__head">
                <span className="code-inline">{selected}</span>
                {selectedStatus ? <span className={`status status--${selectedStatus}`}>{STATUS_LABELS[selectedStatus]}</span> : null}
              </div>
              {selectedClaim ? (
                <>
                  <p style={{ margin: '8px 0', color: 'var(--ink-strong)' }}>{selectedClaim.statement}</p>
                  {selectedStatus ? <p className="small muted">{STATUS_DESCRIPTIONS[selectedStatus]}</p> : null}
                  {selectedOutcome ? (
                    <ul className="reasons-plain">
                      {selectedOutcome.reasons.map((r, i) => (
                        <li key={i}>{explain(r, lookup)}</li>
                      ))}
                    </ul>
                  ) : selectedDerivations.length ? (
                    <ul className="reasons-plain">
                      {selectedDerivations.map((d) => (
                        <li key={d.code}>
                          {d.code} “{d.label}”: {d.premises.map((p) => `${p.claim} (${p.necessity})`).join(', ')}
                          {d.axioms.length ? `; ${d.axioms.map((a) => `${a.axiom} (${a.role === 'requires' ? 'required' : 'strengthens'})`).join(', ')}` : ''}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="small muted">Reported directly from its witness; no derivation is needed.</p>
                  )}
                  <div className="button-row" style={{ marginTop: 12 }}>
                    <a
                      role="button"
                      aria-pressed={reject.includes(selected)}
                      className="button button--quiet"
                      href={hrefFor(basePath, toggleNext(selected), lens)}
                      onClick={onLinkToggle(selected)}
                      onKeyDown={onSpace(selected)}
                    >
                      {reject.includes(selected) ? 'Restore this claim' : 'Reject this claim'}
                    </a>
                    <Link className="button button--quiet" href={`/claims/${selected}`}>
                      Open the full record
                    </Link>
                  </div>
                </>
              ) : selectedAxiom ? (
                <>
                  <p style={{ margin: '8px 0', color: 'var(--ink-strong)' }}>{selectedAxiom.label}</p>
                  <p className="small muted">Held by {selectedAxiom.heldBy}.</p>
                  <div className="button-row" style={{ marginTop: 12 }}>
                    <a
                      role="button"
                      aria-pressed={reject.includes(selected)}
                      className="button button--quiet"
                      href={hrefFor(basePath, toggleNext(selected), lens)}
                      onClick={onLinkToggle(selected)}
                      onKeyDown={onSpace(selected)}
                    >
                      {reject.includes(selected) ? 'Restore this principle' : 'Reject this principle'}
                    </a>
                  </div>
                </>
              ) : null}
            </div>
          ) : null}

          <h3 className="subheading" style={{ marginTop: 28 }}>
            What follows
          </h3>
          {affectedInScope.length === 0 ? (
            <p className="small muted">{nothingRejected ? 'Reject a principle or a claim to see its effect.' : 'Nothing in this case depends on what you rejected.'}</p>
          ) : (
            <ul className="affected-list">
              {affectedInScope.map((a) => (
                <li key={a.code}>
                  <div className="claim-card__head">
                    <button type="button" className="linkish code-inline" onClick={() => setSelected(a.code)}>
                      {a.code}
                    </button>
                    <span className={`status status--${a.status}`}>{STATUS_LABELS[a.status]}</span>
                    <span>via {a.via.join(' → ')}</span>
                  </div>
                  <p style={{ margin: '6px 0 0' }}>{lookup.claim(a.code)}</p>
                  <ul className="reasons-plain">
                    {a.reasons.map((r, i) => (
                      <li key={i}>{explain(r, lookup)}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
          {result.affected.length > affectedInScope.length ? (
            <p className="small faint">
              {result.affected.length - affectedInScope.length} further claim(s) elsewhere in the record are affected.
            </p>
          ) : null}

          {result.mapEdges.length > 0 ? (
            <>
              <h3 className="subheading" style={{ marginTop: 28 }}>
                Covenant Map and Doctrine Graph
              </h3>
              <ul className="affected-list">
                {result.mapEdges.map((e) => (
                  <li key={`${e.mapKind}:${e.code}`}>
                    <span className="code-inline">{e.code}</span> <span className={`status status--${e.status}`}>{EDGE_STATUS_LABELS[e.status]}</span>{' '}
                    <span className="small">{edgeLabels[`${e.mapKind}:${e.code}`] ?? ''}</span>
                    <p className="small muted" style={{ margin: '4px 0 0' }}>
                      {e.groundedBy.length
                        ? `Still grounded by ${e.groundedBy.join(', ')}.`
                        : 'No grounding claim survives.'}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          <h3 className="subheading" style={{ marginTop: 28 }}>
            Rival readings
          </h3>
          <p className="small faint" style={{ marginTop: 0 }}>
            Setting an assumption aside does not settle a dispute. Counter-models that also deny it are shown as consistent
            with what was set aside; those that need it, as not established under the selected assumptions.
          </p>
          {result.counterModels.filter((m) => m.status !== 'unaffected').length === 0 ? (
            <p className="small muted">No counter-model is affected.</p>
          ) : (
            <ul className="affected-list">
              {result.counterModels
                .filter((m) => m.status !== 'unaffected')
                .map((m) => (
                  <li key={m.code}>
                    <span className="code-inline">{m.code}</span> <span className={`status status--${m.status}`}>{COUNTER_STATUS_LABELS[m.status]}</span>{' '}
                    {counterModels[m.code]?.title} <span className="faint small">— {counterModels[m.code]?.heldBy}</span>
                    <p className="small muted" style={{ margin: '4px 0 0' }}>
                      {m.status === 'aligned' ? `Also denies ${m.alignedWith.join(', ')}.` : `Needs ${m.underminedBy.join(', ')}.`}
                    </p>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
