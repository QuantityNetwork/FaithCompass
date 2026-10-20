import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { OutcomeChip, ReviewChip } from '@/components/ds/status';
import { ArgumentGraph } from '@/components/research/argument-graph';
import { InspectorBody } from '@/components/research/inspector';
import { InspectorDialog } from '@/components/research/inspector-dialog';
import { PipelineReplay } from '@/components/research/pipeline-replay';
import { SaveTraceButton, SavedTraces } from '@/components/research/saved-traces';
import { AutoSubmit, PrintButton } from '@/components/research/workspace-tools';
import {
  COLUMN_META,
  FAMILY_ORDER,
  REVIEW_FILTER_LABELS,
  VISION_ID,
  VISION_QUESTION,
  anyFilter,
  buildDossier,
  claimPermalink,
  columnOf,
  coverageItems,
  dossierPath,
  filterOptions,
  intraTradition,
  matchesFilters,
  outcomes,
  parseFilters,
  parseOff,
  pipelineSteps,
  resolveQuestion,
  type Column,
  type Dossier,
  type Filters,
} from '@/lib/research/dossier';
import { getRecord, type AbrahamMosesRecord } from '@/lib/record/record';
import { ACCEPTANCE_META, CLASSIFICATION_META, FAMILY_META, isEditorVerified } from '@/lib/record/taxonomy';
import { canonicalOrigin } from '@/lib/site/config';
import { param, type SearchParams } from '@/lib/site/explorer';

type Props = { searchParams: Promise<SearchParams> };
type View = 'dossier' | 'graph' | 'table';
const VIEWS: Array<{ id: View; label: string }> = [
  { id: 'dossier', label: 'Dossier' },
  { id: 'graph', label: 'Argument graph' },
  { id: 'table', label: 'Table' },
];

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  const base = {
    description:
      'Ask a theological question and see the published record behind it, split into direct evidence, interpretations, inferences and unresolved questions. No sign-in, no generated text.',
  };
  const c = param(sp, 'case');
  if (c) {
    const rc = getRecord().researchCase(c);
    return { ...base, title: rc ? `Dossier: ${rc.title}` : 'Research', alternates: { canonical: `/research?case=${c}` } };
  }
  if (param(sp, 'dossier') === VISION_ID) return { ...base, title: 'Dossier: the Abrahamic and Mosaic covenants', alternates: { canonical: `/research?dossier=${VISION_ID}` } };
  // Free-text searches are not indexed: their addresses should not spread.
  if (param(sp, 'q')) return { ...base, title: 'Research', robots: { index: false, follow: true } };
  return { ...base, title: 'Research', alternates: { canonical: '/research' } };
}

function multi(sp: SearchParams, k: string): string {
  const v = sp[k];
  return Array.isArray(v) ? v.join(',') : (v ?? '');
}

export default async function ResearchPage({ searchParams }: Props) {
  const sp = await searchParams;
  const record = getRecord();
  const caseSlug = param(sp, 'case');
  const dossierId = param(sp, 'dossier');
  const q = (param(sp, 'q') ?? '').trim().slice(0, 500);

  if (!caseSlug && !dossierId && !q) return <Landing record={record} />;

  // A free-text question that matches a published case or dossier is read at that address instead.
  if (q && !caseSlug && !dossierId) {
    const res = resolveQuestion(record, q);
    if (res.kind === 'case') redirect(`/research?case=${res.slug}`);
    if (res.kind === 'dossier') redirect(`/research?dossier=${res.id}`);
  }

  const d = buildDossier(record, caseSlug ? { case: caseSlug } : dossierId ? { dossier: dossierId } : { q });
  const filters = parseFilters((k) => param(sp, k));
  const off = parseOff(record, multi(sp, 'off'));
  const viewParam = param(sp, 'view');
  const view: View = viewParam === 'graph' || viewParam === 'table' ? viewParam : 'dossier';
  const inspectRaw = param(sp, 'inspect');
  const inspect = inspectRaw && record.claim(inspectRaw) ? inspectRaw : null;
  const out = outcomes(record, off);
  const origin = canonicalOrigin();

  const state: Record<string, string | undefined> = {
    ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
    off: off.length ? off.join(',') : undefined,
  };
  const href = (extra: Record<string, string | undefined> = {}) =>
    dossierPath(d, { ...state, view: view === 'dossier' ? undefined : view, ...extra });
  const inspectHref = (code: string) => href({ inspect: code });
  const closeHref = href();

  if (d.mode === 'none') return <NoAnswer record={record} d={d} />;

  const visible = d.claims.filter((c) => matchesFilters(record, record.claim(c)!, filters));
  const byCol = (k: Column) => visible.filter((c) => columnOf(record.current(record.claim(c)!).classification) === k);
  const revs = d.claims.map((c) => record.current(record.claim(c)!));
  const verified = revs.filter((r) => isEditorVerified(r.status)).length;
  const coverage = coverageItems(record, d);
  const opts = filterOptions(record, d.claims);
  const visibleDerivations = d.derivations.filter((code) => visible.includes(record.data.derivations.find((x) => x.code === code)!.claim));
  const exportBase = dossierPath(d, state).replace('/research?', '/research/export?');

  return (
    <main id="main" className="am-wrap rw">
      <header className="rw-head">
        <p className="eyebrow">
          Research workspace · {d.mode === 'case' ? 'Case dossier' : d.mode === 'vision' ? 'Assembled dossier' : 'Search of the record'}
        </p>
        <h1 id="rw-title" className="rw-title" tabIndex={-1}>
          {d.question}
        </h1>
        <p className="rw-scope">{d.scope}</p>
        <div className="rw-status">
          <span className={`rw-cov rw-cov--${d.coverage}`}>
            {d.coverage === 'full' ? 'Full coverage' : 'Partial coverage'}
            <span className="rw-cov__note">
              {d.coverage === 'full'
                ? ' · a published research case asks this question'
                : ' · no published case asks this question as such; see the gaps below'}
            </span>
          </span>
          <span className="rw-review">
            {verified} of {revs.length} records editor-verified · {revs.length - verified} provisional, awaiting editorial review · 0
            externally reviewed
          </span>
        </div>
        {d.guardrail ? (
          <div className="status-notice rw-guard" role="note">
            <p style={{ margin: 0 }}>{d.guardrail.message}</p>
          </div>
        ) : null}
      </header>

      <AskForm defaultValue={d.mode === 'search' ? d.question : ''} compact />

      <div className="rw-grid">
        <aside className="rw-side no-print" aria-label="Filters and coverage">
          <form id="rw-filters" action="/research" method="get" className="rw-filters">
            {d.mode === 'case' ? <input type="hidden" name="case" value={d.id} /> : null}
            {d.mode === 'vision' ? <input type="hidden" name="dossier" value={d.id} /> : null}
            {d.mode === 'search' ? <input type="hidden" name="q" value={d.question} /> : null}
            {view !== 'dossier' ? <input type="hidden" name="view" value={view} /> : null}
            {off.length ? <input type="hidden" name="off" value={off.join(',')} /> : null}
            <h2 className="rw-side__title">Filters</h2>
            <FilterSelect name="source" label="Source" value={filters.source} options={opts.source} />
            <FilterSelect name="tradition" label="Tradition" value={filters.tradition} options={opts.tradition} />
            <FilterSelect name="language" label="Language" value={filters.language} options={opts.language} />
            <FilterSelect name="period" label="Period" value={filters.period} options={opts.period} />
            <FilterSelect name="state" label="Review state" value={filters.state} options={opts.state} />
            <div className="rw-filters__actions">
              <button className="button" type="submit">
                Apply
              </button>
              {anyFilter(filters) ? (
                <Link className="link rw-small" href={dossierPath(d, { off: state.off, view: view === 'dossier' ? undefined : view })}>
                  Clear filters
                </Link>
              ) : null}
            </div>
            <p className="rw-small rw-faint" aria-live="polite">
              Showing {visible.length} of {d.claims.length} records.
            </p>
            <AutoSubmit formId="rw-filters" />
          </form>

          <section aria-labelledby="rw-cov-title" className="rw-covtable">
            <h2 id="rw-cov-title" className="rw-side__title">
              Coverage
            </h2>
            <ul>
              {coverage.map((c) => (
                <li key={c.component} className={`rw-mark rw-mark--${c.mark}`}>
                  <span className="rw-mark__sym" aria-hidden="true">
                    {c.mark === 'covered' ? '●' : c.mark === 'partial' ? '◐' : '○'}
                  </span>
                  <span>
                    {c.component}
                    <span className="rw-faint">
                      {' '}
                      · {c.mark === 'covered' ? 'covered' : c.mark === 'partial' ? 'partial' : 'not covered'} · {c.detail}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </aside>

        <div className="rw-main">
          <nav className="rw-tabs no-print" aria-label="Views">
            {VIEWS.map((v) => (
              <Link key={v.id} href={dossierPath(d, { ...state, view: v.id === 'dossier' ? undefined : v.id })} aria-current={view === v.id ? 'page' : undefined} scroll={false}>
                {v.label}
              </Link>
            ))}
            <a className="rw-tabs__filters" href="#rw-filters">
              Filters{anyFilter(filters) ? ' · on' : ''}
            </a>
          </nav>

          {view === 'dossier' ? (
            <DossierView record={record} d={d} visible={visible} byCol={byCol} out={out} inspectHref={inspectHref} filters={filters} clearHref={dossierPath(d, { off: state.off })} />
          ) : view === 'graph' ? (
            <section aria-labelledby="rw-graph-title">
              <h2 id="rw-graph-title" className="section-title">
                Argument graph
              </h2>
              <ArgumentGraph record={record} derivations={visibleDerivations} out={out} inspectHref={inspectHref} tableHref={dossierPath(d, { ...state, view: 'table' })} />
              <Assumptions record={record} d={d} off={off} state={state} view={view} />
            </section>
          ) : (
            <TableView record={record} visible={visible} out={out} inspectHref={inspectHref} />
          )}

          <section className="rw-block no-print" aria-labelledby="rw-pipe-title">
            <h2 id="rw-pipe-title" className="section-title">
              How this dossier was assembled
            </h2>
            <PipelineReplay steps={pipelineSteps(record, d)} />
          </section>

          <section className="rw-block" aria-labelledby="rw-export-title">
            <h2 id="rw-export-title" className="section-title">
              Export and cite
            </h2>
            <div className="button-row no-print" style={{ marginTop: 0 }}>
              <a className="button" href={`${exportBase}&format=json`} download>
                JSON
              </a>
              <a className="button" href={`${exportBase}&format=md`} download>
                Markdown
              </a>
              <PrintButton />
              <SaveTraceButton title={d.question} />
            </div>
            <p className="rw-small">
              <span className="rw-label">Permanent address</span>{' '}
              <a className="link" href={dossierPath(d, state)}>
                {origin}
                {dossierPath(d, state)}
              </a>
            </p>
            <p className="rw-small rw-faint">
              Both exports carry a reproducibility manifest: record version <span className="mono">{record.version}</span>, every
              claim with its revision, the assumptions set aside and the filters applied. Each claim keeps its own permanent
              revision address.
            </p>
          </section>
        </div>
      </div>

      <SavedTraces />

      {inspect ? (
        <InspectorDialog code={inspect} closeHref={closeHref}>
          <InspectorBody record={record} code={inspect} out={out} origin={origin} inDossier={inspectHref} />
        </InspectorDialog>
      ) : null}
    </main>
  );
}

/* ------------------------------------------------------------------ pieces */

function AskForm({ defaultValue = '', compact = false }: { defaultValue?: string; compact?: boolean }) {
  return (
    <form className={`rw-ask${compact ? ' rw-ask--compact' : ''} no-print`} action="/research/ask" method="post" role="search" aria-label="Ask the record">
      <label htmlFor="rw-q" className="visually-hidden">
        Research question
      </label>
      <input id="rw-q" name="q" type="search" defaultValue={defaultValue} maxLength={500} autoComplete="off" placeholder="Ask a research question…" required />
      <button className="button button--solid" type="submit">
        Research
      </button>
    </form>
  );
}

function FilterSelect({ name, label, value, options }: { name: string; label: string; value: string; options: Array<{ value: string; label: string }> }) {
  return (
    <label className="rw-field">
      <span>{label}</span>
      <select name={name} defaultValue={value}>
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ClaimItem({ record, code, out, inspectHref }: { record: AbrahamMosesRecord; code: string; out: ReturnType<typeof outcomes>; inspectHref: (c: string) => string }) {
  const r = record.current(record.claim(code)!);
  return (
    <li className="rw-item">
      <p className="rw-item__meta">
        <span className="mono">{code}</span> · {CLASSIFICATION_META[r.classification].label}
      </p>
      <p className="rw-item__text">{r.statement}</p>
      <p className="rw-item__refs">{r.primaryWitnesses.map((w) => w.display).join(' · ')}</p>
      <div className="rw-item__foot">
        <ReviewChip status={r.status} short />
        <OutcomeChip status={out.claim(code)} />
        <span className="rw-item__links no-print">
          <Link href={inspectHref(code)} scroll={false} data-inspect-trigger={code} aria-label={`Inspect ${code}`}>
            Inspect
          </Link>
          <a href={claimPermalink(record, code)} aria-label={`Permanent link to ${code}, revision ${r.rev}`}>
            Permalink
          </a>
        </span>
      </div>
    </li>
  );
}

function Column({ id, title, description, count, children }: { id: string; title: string; description: string; count: number; children: ReactNode }) {
  return (
    <section className={`rw-col rw-col--${id}`} aria-labelledby={`rw-col-${id}`}>
      <h3 id={`rw-col-${id}`} className="rw-col__title">
        {title} <span className="rw-col__n">{count}</span>
      </h3>
      <p className="rw-col__desc">{description}</p>
      {children}
    </section>
  );
}

function DossierView({
  record,
  d,
  visible,
  byCol,
  out,
  inspectHref,
  filters,
  clearHref,
}: {
  record: AbrahamMosesRecord;
  d: Dossier;
  visible: string[];
  byCol: (k: Column) => string[];
  out: ReturnType<typeof outcomes>;
  inspectHref: (c: string) => string;
  filters: Filters;
  clearHref: string;
}) {
  const empty = (
    <p className="rw-empty">
      {anyFilter(filters) ? (
        <>
          No record in this column matches the filters.{' '}
          <Link className="link" href={clearHref}>
            Clear filters
          </Link>
        </>
      ) : (
        'The record holds nothing for this column.'
      )}
    </p>
  );
  const intra = intraTradition(record, d.positions.filter((p) => visible.includes(p.claim)));
  return (
    <>
      <section className="rw-block" aria-labelledby="rw-sum-title">
        <h2 id="rw-sum-title" className="section-title">
          What the record says
        </h2>
        <p className="rw-small rw-faint" style={{ marginTop: 0 }}>
          Every line below is a published record statement, quoted verbatim. Headings are structural; nothing is
          composed.
        </p>
        {d.summaryText ? <p className="rw-lead">{d.summaryText}</p> : null}
        {d.summary?.map((g) => (
          <div key={g.title} className="rw-sum">
            <h3 className="rw-sum__title">{g.title}</h3>
            <ul>
              {g.items.map((code) => {
                if (code.startsWith('AM-COV-')) {
                  const e = record.covenantEdge(code);
                  return e ? (
                    <li key={code}>
                      {e.description}{' '}
                      <Link className="code-inline" href={`/covenants#${code}`}>
                        {code}
                      </Link>
                    </li>
                  ) : null;
                }
                const c = record.claim(code);
                return c ? (
                  <li key={code}>
                    {record.current(c).statement}{' '}
                    <Link className="code-inline" href={inspectHref(code)} scroll={false} data-inspect-trigger={code}>
                      {code}
                    </Link>
                  </li>
                ) : null;
              })}
            </ul>
          </div>
        ))}
      </section>

      <section className="rw-block" aria-labelledby="rw-split-title">
        <h2 id="rw-split-title" className="section-title">
          Evidence, interpretation, inference — and what remains open
        </h2>
        <div className="rw-split">
          {(['direct', 'interpretation', 'inference'] as const).map((k) => {
            const list = byCol(k);
            return (
              <Column key={k} id={k} title={COLUMN_META[k].title} description={COLUMN_META[k].description} count={list.length}>
                {list.length ? (
                  <ul className="rw-list">
                    {list.map((c) => (
                      <ClaimItem key={c} record={record} code={c} out={out} inspectHref={inspectHref} />
                    ))}
                  </ul>
                ) : (
                  empty
                )}
              </Column>
            );
          })}
          <Column
            id="unresolved"
            title={COLUMN_META.unresolved.title}
            description={COLUMN_META.unresolved.description}
            count={d.counterModels.length + d.gaps.length + d.limitations.length}
          >
            <ul className="rw-list">
              {d.counterModels.map((code) => {
                const m = record.counterModel(code)!;
                return (
                  <li key={code} className="rw-item rw-item--cm">
                    <p className="rw-item__meta">
                      <span className="mono">{code}</span> · Counter-model · {m.heldBy}
                    </p>
                    <p className="rw-item__text">{m.thesis}</p>
                    <p className="rw-item__refs">
                      Contests{' '}
                      <Link href={inspectHref(m.targets)} scroll={false}>
                        {m.targets}
                      </Link>{' '}
                      · <ReviewChip status={m.status} short />
                    </p>
                  </li>
                );
              })}
              {d.gaps.map((g, i) => (
                <li key={`g${i}`} className="rw-item rw-item--gap">
                  <p className="rw-item__meta">Coverage gap · computed from the record</p>
                  <p className="rw-item__text">{g.text}</p>
                  <p className="rw-item__refs">{g.basis}</p>
                </li>
              ))}
              {d.limitations.map((l, i) => (
                <li key={`l${i}`} className="rw-item rw-item--gap">
                  <p className="rw-item__meta">Known limitation · from the published case</p>
                  <p className="rw-item__text">{l}</p>
                </li>
              ))}
            </ul>
          </Column>
        </div>
      </section>

      {d.positions.length ? (
        <section className="rw-block" aria-labelledby="rw-pos-title">
          <h2 id="rw-pos-title" className="section-title">
            Positions, by tradition
          </h2>
          <div className="rw-pos">
            {FAMILY_ORDER.map((f) => {
              const ps = d.positions.filter((p) => p.family === f && visible.includes(p.claim));
              if (!ps.length) return null;
              return (
                <div key={f} className="rw-pos__fam">
                  <h3 className="rw-sum__title">{FAMILY_META[f].label}</h3>
                  <ul>
                    {ps.map((p) => (
                      <li key={p.claim}>
                        <Link href={inspectHref(p.claim)} scroll={false} data-inspect-trigger={p.claim}>
                          {p.label}
                        </Link>
                        <span className="rw-faint"> — {p.traditions.map((t) => record.tradition(t)?.name ?? t).join(', ')}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
          {intra.length ? (
            <>
              <h3 className="rw-sum__title" style={{ marginTop: 22 }}>
                Disagreement inside a tradition
              </h3>
              <ul className="rw-intra">
                {intra.map(({ position, entries }) => (
                  <li key={position.claim}>
                    <span>{position.label}</span>
                    {entries.map((a) => (
                      <span key={a.tradition} className="rw-faint">
                        {' '}
                        · {ACCEPTANCE_META[a.stance].label.toLowerCase()} by {record.tradition(a.tradition)?.name ?? a.tradition}
                        {a.note ? `: ${a.note}` : ''}
                      </span>
                    ))}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
      ) : null}
    </>
  );
}

function Assumptions({
  record,
  d,
  off,
  state,
  view,
}: {
  record: AbrahamMosesRecord;
  d: Dossier;
  off: string[];
  state: Record<string, string | undefined>;
  view: View;
}) {
  if (!d.axioms.length) return null;
  return (
    <form action="/research" method="get" className="rw-assume no-print">
      {d.mode === 'case' ? <input type="hidden" name="case" value={d.id} /> : null}
      {d.mode === 'vision' ? <input type="hidden" name="dossier" value={d.id} /> : null}
      {d.mode === 'search' ? <input type="hidden" name="q" value={d.question} /> : null}
      <input type="hidden" name="view" value={view} />
      {Object.entries(state)
        .filter(([k, v]) => k !== 'off' && v)
        .map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
      <fieldset>
        <legend className="rw-side__title">Test the declared assumptions</legend>
        <p className="rw-small rw-faint" style={{ marginTop: 0 }}>
          Set an assumption aside and the graph shows which arguments still hold. Outcomes use the §6.4 wording and are
          computed by the dependency engine; no tradition is judged.
        </p>
        <ul>
          {d.axioms.map((a) => (
            <li key={a}>
              <label>
                <input type="checkbox" name="off" value={a} defaultChecked={off.includes(a)} /> <span className="mono">{a}</span>{' '}
                {record.axiom(a)?.label}
              </label>
            </li>
          ))}
        </ul>
        <button className="button" type="submit">
          Recompute
        </button>
      </fieldset>
    </form>
  );
}

function TableView({ record, visible, out, inspectHref }: { record: AbrahamMosesRecord; visible: string[]; out: ReturnType<typeof outcomes>; inspectHref: (c: string) => string }) {
  return (
    <section aria-labelledby="rw-table-title">
      <h2 id="rw-table-title" className="section-title">
        Every record in this view
      </h2>
      <div className="table-wrap">
        <table className="table table--stack">
          <caption className="visually-hidden">Records in this dossier with their column, classification, witnesses, review state and outcome</caption>
          <thead>
            <tr>
              <th scope="col">Record</th>
              <th scope="col">Statement</th>
              <th scope="col">Column</th>
              <th scope="col">Witnesses</th>
              <th scope="col">Review</th>
              <th scope="col">Outcome</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((code) => {
              const r = record.current(record.claim(code)!);
              return (
                <tr key={code}>
                  <td data-label="Record">
                    <Link className="mono" href={inspectHref(code)} scroll={false} data-inspect-trigger={code}>
                      {code}
                    </Link>
                  </td>
                  <td data-label="Statement">{r.statement}</td>
                  <td data-label="Column">
                    {COLUMN_META[columnOf(r.classification)].title}
                    <br />
                    <span className="rw-faint">{CLASSIFICATION_META[r.classification].label}</span>
                  </td>
                  <td data-label="Witnesses">{r.primaryWitnesses.map((w) => w.display).join('; ')}</td>
                  <td data-label="Review">
                    <ReviewChip status={r.status} short />
                  </td>
                  <td data-label="Outcome">
                    <OutcomeChip status={out.claim(code)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function NoAnswer({ record, d }: { record: AbrahamMosesRecord; d: Dossier }) {
  return (
    <main id="main" className="am-wrap rw">
      <header className="rw-head">
        <p className="eyebrow">Research workspace · No coverage</p>
        <h1 id="rw-title" className="rw-title" tabIndex={-1}>
          The record does not yet answer this question.
        </h1>
        <p className="rw-scope">
          You asked about: <span className="rw-asked">{d.question}</span>. No published claim, case or dossier matches it, so
          there is nothing to show — and nothing is generated to fill the gap.
        </p>
      </header>
      {d.guardrail ? (
        <div className="status-notice rw-guard" role="note">
          <p style={{ marginTop: 0 }}>{d.guardrail.message}</p>
          {d.guardrail.suggestedClaims.length ? (
            <ul style={{ marginBottom: 0 }}>
              {d.guardrail.suggestedClaims.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <AskForm defaultValue={d.question} compact />
      <div className="rw-split rw-split--empty" aria-label="The four columns, empty">
        {(['direct', 'interpretation', 'inference', 'unresolved'] as const).map((k) => (
          <section key={k} className="rw-col" aria-labelledby={`rw-none-${k}`}>
            <h2 id={`rw-none-${k}`} className="rw-col__title">
              {COLUMN_META[k].title} <span className="rw-col__n">0</span>
            </h2>
            <p className="rw-empty">{k === 'unresolved' ? 'The whole question is open in the record.' : 'Nothing in the record.'}</p>
          </section>
        ))}
      </div>
      <section className="rw-block" aria-labelledby="rw-covered-title">
        <h2 id="rw-covered-title" className="section-title">
          What the record does cover
        </h2>
        <SuggestedQuestions record={record} />
        <p className="rw-small rw-faint">
          The <Link className="link" href="/corpus">corpus page</Link> lists every work cited and the gaps the editors know about.
        </p>
      </section>
    </main>
  );
}

function SuggestedQuestions({ record }: { record: AbrahamMosesRecord }) {
  return (
    <ul className="rw-cases">
      <li>
        <Link className="card card--link" href={`/research?dossier=${VISION_ID}`}>
          <span className="card__meta">Assembled dossier · partial coverage</span>
          <span className="card__title" style={{ display: 'block' }}>
            {VISION_QUESTION}
          </span>
        </Link>
      </li>
      {record.data.cases.map((rc) => (
        <li key={rc.slug}>
          <Link className="card card--link" href={`/research?case=${rc.slug}`}>
            <span className="card__meta">Research case · {record.claimsInCase(rc.slug).length} records</span>
            <span className="card__title" style={{ display: 'block' }}>
              {rc.question}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Landing({ record }: { record: AbrahamMosesRecord }) {
  return (
    <main id="main" className="am-wrap rw">
      <header className="rw-head">
        <p className="eyebrow">Research workspace</p>
        <h1 id="rw-title" className="display">
          Begin with a question.
        </h1>
        <p className="standfirst" style={{ fontStyle: 'normal' }}>
          Ask by question, scripture reference or topic. The answer is the published record behind it, split into direct
          evidence, interpretations, inferences and unresolved questions — every item attributed, with its provenance.
          Nothing is generated.
        </p>
      </header>
      <AskForm />
      <p className="rw-small rw-faint rw-privacy">
        Your question is sent in the body of the request, not the address, so it does not appear in server logs or your
        browser history. A question that matches a published case or dossier opens at that dossier&apos;s address; any
        other question is reduced to its search terms in the address.
      </p>
      <section className="rw-block" aria-labelledby="rw-sugg-title">
        <h2 id="rw-sugg-title" className="section-title">
          Questions the record can answer today
        </h2>
        <SuggestedQuestions record={record} />
      </section>
      <section className="rw-block" aria-labelledby="rw-rev-title">
        <h2 id="rw-rev-title" className="section-title">
          Review state
        </h2>
        <p className="rw-small">
          Filter any dossier by review state: {Object.values(REVIEW_FILTER_LABELS).join(' · ')}. Today{' '}
          {record.data.claims.filter((c) => isEditorVerified(record.current(c).status)).length} of {record.data.claims.length} claims
          are editor-verified and {record.data.claims.filter((c) => record.current(c).status === 'externally_reviewed').length} externally
          reviewed.
        </p>
      </section>
      <SavedTraces />
    </main>
  );
}
