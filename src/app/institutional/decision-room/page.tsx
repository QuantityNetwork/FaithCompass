import type { Metadata } from 'next';
import Link from 'next/link';
import { DecisionTwinLogo } from '@/components/decision/brand';
import { ClassChip, ConditionChip, SyntheticNotice, fmtValue } from '@/components/decision/ui';
import { CASE, DOCUMENTS, RULESET_VERSION, documentHash } from '@/lib/decision/case';
import { CHAMBER_RULES, chamber, type Side } from '@/lib/decision/chamber';
import { contradictionsView } from '@/lib/decision/contradictions';
import {
  CONTROLS,
  DEFAULT_ASSUMPTIONS,
  PREMISES,
  evaluate,
  parseAssumptions,
  traceFromDefaults,
  type ConditionStatus,
} from '@/lib/decision/engine';
import { encodePassportId } from '@/lib/decision/passport';
import { DEFAULT_WORKSPACE_SETTINGS, PRODUCT, decisionConfiguration } from '@/lib/decision/product';

export const metadata: Metadata = {
  title: 'Decision Room · AbrahamMoses Decision Twin',
  description:
    'AbrahamMoses Decision Twin demonstration: a synthetic private credit decision traced from source documents through assumptions, calculations, opposing evidence and contradictions to a reproducible Decision Passport. Fictional data; no approval is made.',
  alternates: { canonical: '/institutional/decision-room' },
};

const STEPS = [
  ['decision', 'Decision'],
  ['sources', 'Source documents'],
  ['assumptions', 'Assumptions'],
  ['calculations', 'Calculations'],
  ['conditions', 'Conditions'],
  ['chamber', 'Adversarial Chamber'],
  ['contradictions', 'Contradiction Map'],
  ['graph', 'Reasoning graph'],
  ['human', 'Human decision'],
  ['passport', 'Decision Passport'],
] as const;

const SIDE_TITLE: Record<Side, string> = { SUPPORTING: 'Supporting case', OPPOSING: 'Opposing case', AUDITOR: 'Evidence auditor' };

export default async function DecisionRoomPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const a = parseAssumptions(await searchParams);
  const ev = evaluate(a);
  const nodes = Object.values(ev);
  const trace = traceFromDefaults(a);
  const changed = new Set(trace.affected);
  const args = chamber(ev, a);
  const conflicts = contradictionsView();
  const conditions = nodes.filter((n) => n.kind === 'condition');
  const judgment = conditions.filter((n) => n.status === 'NEEDS_HUMAN_JUDGMENT' || n.status === 'EVIDENCE_MISSING');
  const passportId = encodePassportId(a, new Date());
  const config = decisionConfiguration(a);
  const Changed = ({ id }: { id: string }) => (changed.has(id) ? <span className="am-chip am-chip--flag dr-changed">changed</span> : null);

  return (
    <main id="main" className="am-page dr">
      <div className="am-wrap">
        <header className="am-page__head">
          <div className="dt-brand">
            <DecisionTwinLogo height={120} />
          </div>
          <p className="am-eyebrow">{PRODUCT.name} · Sagolik Institutional · Demonstration</p>
          <h1 className="am-h1">Decision Room</h1>
          <p className="dt-principle">{PRODUCT.principle}</p>
          <p className="am-lede">
            One decision, traced from its source documents to a record anyone can reproduce: the assumptions it rests on,
            the arithmetic, the case against it, the places the documents disagree and what still needs a person to
            decide.
          </p>
          <SyntheticNotice>
            <p className="am-tiny">
              AbrahamMoses is a scholarly research record. Sagolik Institutional is a <strong>proposed</strong> commercial
              application of the same method (sources, assumptions, dependencies, review) to institutional decisions. It has
              not been validated by any bank or institution. <Link href="/institutional#decision-room">More on the difference</Link>.
            </p>
          </SyntheticNotice>
        </header>

        <nav aria-label="Decision Room steps" className="dr-steps">
          <ol>
            {STEPS.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`}>{label}</a>
              </li>
            ))}
          </ol>
        </nav>

        <section className="am-section" id="decision" aria-labelledby="decision-title">
          <div className="am-section__head">
            <p className="am-eyebrow">1 · Decision</p>
            <h2 className="am-h2" id="decision-title">
              {CASE.question}
            </h2>
          </div>
          <p>
            {CASE.borrower} asks for a ${CASE.facility.total}M senior secured facility to {CASE.facility.purpose.toLowerCase()}. Case{' '}
            <span className="am-mono">{CASE.id}</span> v{CASE.version}.
          </p>
          <div className="table-wrap">
            <table className="table table--stack">
              <caption className="am-sr">Facility structure</caption>
              <thead>
                <tr>
                  <th scope="col">Tranche</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Terms</th>
                </tr>
              </thead>
              <tbody>
                {CASE.facility.tranches.map((t) => (
                  <tr key={t.name}>
                    <td data-label="Tranche">{t.name}</td>
                    <td data-label="Amount">${t.amount}M</td>
                    <td data-label="Terms">{t.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3 className="am-h3" id="configuration">Decision configuration</h3>
          <p className="am-tiny">
            Configuration <span className="am-mono">{config.version}</span>. Saved into every Decision Passport with the
            assumption values below, and covered by its hash, so the record can be reproduced. In a private workspace these
            would be set per decision; here they are fixed for the synthetic case.
          </p>
          <dl className="dr-meta">
            <dt>Objective</dt>
            <dd>{config.objective}</dd>
            <dt>Evidence standard</dt>
            <dd>{config.evidence_standard}</dd>
            <dt>Approval policy</dt>
            <dd>
              {config.approval_policy.actions.join(' / ')}. {config.approval_policy.rule}
            </dd>
            <dt>Escalation rules</dt>
            <dd>
              <ul>
                {config.escalation_rules.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </dd>
            <dt>Monitoring triggers</dt>
            <dd>
              <ul>
                {config.monitoring_triggers.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </dd>
          </dl>
          <div className="table-wrap">
            <table className="table table--stack">
              <caption className="am-sr">Assumption states: fixed, adjustable and disputed</caption>
              <thead>
                <tr>
                  <th scope="col">State</th>
                  <th scope="col">Assumption</th>
                  <th scope="col">Value</th>
                  <th scope="col">Source</th>
                </tr>
              </thead>
              <tbody>
                {config.assumptions.map((x) => (
                  <tr key={x.label}>
                    <td data-label="State">
                      <span className="am-mono">{x.state.toLowerCase()}</span>
                    </td>
                    <td data-label="Assumption">
                      {x.label}
                      <br />
                      <span className="am-tiny">{x.note}</span>
                    </td>
                    <td data-label="Value">{x.value}</td>
                    <td data-label="Source" className="am-mono">
                      {x.source}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details className="dr-details">
            <summary>Default workspace settings (planned for private workspaces; read-only)</summary>
            <p className="am-tiny">
              Planned defaults for a private Decision Twin workspace. No private workspace exists yet; nothing here can be
              changed and none of it is in effect on this public site.
            </p>
            <dl className="dr-meta">
              {DEFAULT_WORKSPACE_SETTINGS.map((x) => (
                <div key={x.setting} className="dr-meta__row">
                  <dt>{x.setting}</dt>
                  <dd>{x.value}</dd>
                </div>
              ))}
            </dl>
          </details>
          <p className="am-tiny">
            <Link href="/institutional/decision-twin">About {PRODUCT.name}: the six layers and what is demonstrated now</Link>
          </p>
        </section>

        <section className="am-section" id="sources" aria-labelledby="sources-title">
          <div className="am-section__head">
            <p className="am-eyebrow">2 · Source documents</p>
            <h2 className="am-h2" id="sources-title">
              Ten synthetic documents, each with a content hash
            </h2>
          </div>
          <p className="am-tiny">
            Each document is structured data with a stable ID. The SHA-256 hash of its canonical JSON lets a passport show which
            exact version it relied on. “Verified” is the synthetic data room’s own flag; you can change it under Assumptions.
          </p>
          <ul className="dr-docs">
            {DOCUMENTS.map((d) => (
              <li key={d.id}>
                <details>
                  <summary>
                    <span className="am-mono">{d.id}</span> <strong>{d.title}</strong>{' '}
                    <span className="am-muted">
                      {d.kind} · {d.date} · {a.verified.includes(d.id) ? 'verified' : 'unverified'}
                    </span>
                  </summary>
                  <p>{d.summary}</p>
                  <p className="am-tiny">
                    Author: {d.author}. SHA-256 <span className="am-mono dr-hash">{documentHash(d)}</span>
                  </p>
                  <div className="table-wrap">
                    <table className="table table--stack">
                      <caption className="am-sr">Fields in {d.id}</caption>
                      <thead>
                        <tr>
                          <th scope="col">Field</th>
                          <th scope="col">Value</th>
                          <th scope="col">Period</th>
                          <th scope="col">Basis</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.fields.map((f) => (
                          <tr key={f.key}>
                            <td data-label="Field">{f.label}</td>
                            <td data-label="Value">{fmtValue(f.value, f.unit)}</td>
                            <td data-label="Period">{f.period ?? '—'}</td>
                            <td data-label="Basis">{f.basis ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </section>

        <section className="am-section" id="assumptions" aria-labelledby="assumptions-title">
          <div className="am-section__head">
            <p className="am-eyebrow">3 · Assumptions</p>
            <h2 className="am-h2" id="assumptions-title">
              Change an input or reject a premise
            </h2>
          </div>
          <p className="am-tiny">
            Recalculating reloads the page with your inputs in the address, so every view is a link that reproduces itself.
            Only what depends on a changed input moves; everything else stays as it was.
          </p>
          <form method="get" action="/institutional/decision-room#assumptions" className="dr-form">
            <fieldset>
              <legend>Inputs</legend>
              <div className="dr-controls">
                {CONTROLS.map((c) => (
                  <label key={c.key} className="dr-control">
                    <span>
                      {c.label} ({c.unit}) <span className="am-muted">default {c.default}, {c.source}</span>
                    </span>
                    <input type="number" name={c.param} min={c.min} max={c.max} step={c.step} defaultValue={a[c.key]} />
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>Premises</legend>
              {PREMISES.map((p) => (
                <label key={p.id} className="dr-check">
                  <input type="checkbox" name="r" value={p.id} defaultChecked={a.rejected.includes(p.id)} />
                  <span>
                    Reject {p.id}: {p.statement} <span className="am-muted">If rejected: {p.ifRejected}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <fieldset>
              <legend>Document verification status</legend>
              <input type="hidden" name="vset" value="1" />
              <div className="dr-checks">
                {DOCUMENTS.map((d) => (
                  <label key={d.id} className="dr-check">
                    <input type="checkbox" name="v" value={d.id} defaultChecked={a.verified.includes(d.id)} />
                    <span>
                      {d.id} verified <span className="am-muted">{d.title}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="dr-actions">
              <button type="submit" className="am-btn am-btn--gold">
                Recalculate
              </button>
              <Link className="am-btn" href="/institutional/decision-room#assumptions">
                Reset to case defaults
              </Link>
            </div>
          </form>

          <div className="am-card dr-trace" aria-labelledby="trace-title">
            <h3 className="am-h3" id="trace-title">
              Audit trace
            </h3>
            {trace.changes.length === 0 ? (
              <p className="am-tiny">All inputs are at the case defaults.</p>
            ) : (
              <>
                <ul>
                  {trace.changes.map((c) => (
                    <li key={c.input}>
                      <span className="am-mono">{c.input}</span> {c.label}: {c.from} → <strong>{c.to}</strong>
                    </li>
                  ))}
                </ul>
                <p className="am-tiny">
                  Affected ({trace.affected.length}): <span className="am-mono">{trace.affected.join(', ') || 'none'}</span>. Unchanged:{' '}
                  {nodes.length - trace.affected.length - trace.changes.length} other nodes.
                </p>
              </>
            )}
          </div>
        </section>

        <section className="am-section" id="calculations" aria-labelledby="calc-title">
          <div className="am-section__head">
            <p className="am-eyebrow">4 · Calculations</p>
            <h2 className="am-h2" id="calc-title">
              Every figure, its formula and its inputs
            </h2>
          </div>
          <div className="table-wrap">
            <table className="table table--stack">
              <caption className="am-sr">Calculations</caption>
              <thead>
                <tr>
                  <th scope="col">Measure</th>
                  <th scope="col">Value</th>
                  <th scope="col">Formula</th>
                  <th scope="col">Inputs</th>
                </tr>
              </thead>
              <tbody>
                {nodes
                  .filter((n) => n.kind === 'metric' || n.kind === 'effective')
                  .map((n) => (
                    <tr key={n.id}>
                      <td data-label="Measure">
                        {n.label} <Changed id={n.id} />
                      </td>
                      <td data-label="Value" className="mono">
                        {n.display}
                      </td>
                      <td data-label="Formula">{n.formula}</td>
                      <td data-label="Inputs" className="mono">
                        {n.deps.join(', ') || '—'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="am-section" id="conditions" aria-labelledby="cond-title">
          <div className="am-section__head">
            <p className="am-eyebrow">5 · Conditions</p>
            <h2 className="am-h2" id="cond-title">
              Which conditions are met, and which need a person
            </h2>
          </div>
          <p className="am-note">{ev.conclusion.display}</p>
          <div className="table-wrap">
            <table className="table table--stack">
              <caption className="am-sr">Conditions</caption>
              <thead>
                <tr>
                  <th scope="col">Condition</th>
                  <th scope="col">Status</th>
                  <th scope="col">On these inputs</th>
                  <th scope="col">Sources</th>
                </tr>
              </thead>
              <tbody>
                {conditions.map((n) => (
                  <tr key={n.id}>
                    <td data-label="Condition">
                      {n.label} <Changed id={n.id} />
                    </td>
                    <td data-label="Status">
                      <ConditionChip status={n.status as ConditionStatus} />
                    </td>
                    <td data-label="On these inputs">{n.note}</td>
                    <td data-label="Sources" className="mono">
                      {n.sources.join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3 className="am-h3">Warnings</h3>
          <ul>
            {nodes
              .filter((n) => n.kind === 'warning')
              .map((n) => (
                <li key={n.id}>
                  <strong>{n.status === 'ACTIVE' ? 'Active' : 'Clear'}</strong>: {n.label}
                  {n.note ? `: ${n.note}` : ''} <Changed id={n.id} />
                </li>
              ))}
          </ul>
        </section>

        <section className="am-section" id="chamber" aria-labelledby="chamber-title">
          <div className="am-section__head">
            <p className="am-eyebrow">6 · Adversarial Chamber</p>
            <h2 className="am-h2" id="chamber-title">
              The case for, the case against, and what the evidence can bear
            </h2>
          </div>
          <p className="am-tiny">
            <strong>Deterministic rules, not AI.</strong> Each side is a fixed rule set applied to the same conditions,
            premises and documents shown above. Reject a premise under Assumptions and every side is recomputed. No argument
            here is a human review.
          </p>
          <div className="dr-chamber">
            {(['SUPPORTING', 'OPPOSING', 'AUDITOR'] as Side[]).map((side) => (
              <section key={side} className="am-card" aria-labelledby={`side-${side}`}>
                <h3 className="am-h3" id={`side-${side}`}>
                  {SIDE_TITLE[side]}
                </h3>
                <p className="am-tiny">Rules: {CHAMBER_RULES[side].join(' ')}</p>
                <ul className="dr-args">
                  {args
                    .filter((x) => x.side === side)
                    .map((x) => (
                      <li key={x.id}>
                        {x.text}
                        <span className="am-tiny am-mono dr-refs">
                          {[...x.docs, ...x.nodes.slice(0, 4)].join(' · ')}
                        </span>
                      </li>
                    ))}
                </ul>
              </section>
            ))}
          </div>
        </section>

        <section className="am-section" id="contradictions" aria-labelledby="contra-title">
          <div className="am-section__head">
            <p className="am-eyebrow">7 · Contradiction Map</p>
            <h2 className="am-h2" id="contra-title">
              Where the documents disagree, and where they only seem to
            </h2>
          </div>
          <p className="am-tiny">
            Five classes. Only confirmed and potential conflicts are conflicts. A difference of period, scope, definition or
            version is a different reporting basis and is not called a contradiction.
          </p>
          {conflicts.map((c) => (
            <article key={c.id} className="am-card dr-contra" aria-labelledby={`${c.id}-t`}>
              <h3 className="am-h3" id={`${c.id}-t`}>
                <span className="am-mono">{c.id}</span> {c.title} <ClassChip cls={c.class} />
              </h3>
              <div className="table-wrap">
                <table className="table table--stack">
                  <caption className="am-sr">Side-by-side comparison for {c.id}</caption>
                  <thead>
                    <tr>
                      <th scope="col">Document</th>
                      <th scope="col">Field</th>
                      <th scope="col">Value</th>
                      <th scope="col">Period</th>
                      <th scope="col">Basis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[c.a, c.b].map((s, i) =>
                      s ? (
                        <tr key={s.doc + s.field}>
                          <td data-label="Document">
                            <span className="am-mono">{s.doc}</span> {s.docTitle}
                          </td>
                          <td data-label="Field">{s.label}</td>
                          <td data-label="Value">{fmtValue(s.value, s.unit)}</td>
                          <td data-label="Period">{s.period ?? '—'}</td>
                          <td data-label="Basis">{s.basis ?? '—'}</td>
                        </tr>
                      ) : (
                        <tr key={`missing-${i}`}>
                          <td data-label="Document" colSpan={5}>
                            No document in the data room supports this value.
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
              <p>{c.reasoning}</p>
              <p className="am-tiny">
                <strong>Needs:</strong> {c.humanAction}
                {c.affects.length ? (
                  <>
                    {' '}
                    Bears on <span className="am-mono">{c.affects.join(', ')}</span>.
                  </>
                ) : null}
              </p>
            </article>
          ))}
        </section>

        <section className="am-section" id="graph" aria-labelledby="graph-title">
          <div className="am-section__head">
            <p className="am-eyebrow">8 · Reasoning graph</p>
            <h2 className="am-h2" id="graph-title">
              What depends on what
            </h2>
          </div>
          <p className="am-tiny">
            Every derived node and the nodes it reads. A change propagates only along these edges; the test suite checks that
            nothing outside them moves.
          </p>
          <div className="table-wrap">
            <table className="table table--stack">
              <caption className="am-sr">Dependency graph</caption>
              <thead>
                <tr>
                  <th scope="col">Node</th>
                  <th scope="col">Kind</th>
                  <th scope="col">Depends on</th>
                  <th scope="col">Now</th>
                </tr>
              </thead>
              <tbody>
                {nodes
                  .filter((n) => n.deps.length > 0)
                  .map((n) => (
                    <tr key={n.id}>
                      <td data-label="Node" className="mono">
                        {n.id} <Changed id={n.id} />
                      </td>
                      <td data-label="Kind">{n.kind}</td>
                      <td data-label="Depends on" className="mono">
                        {n.deps.join(', ')}
                      </td>
                      <td data-label="Now">{n.kind === 'conclusion' ? 'see Conditions' : n.display}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="am-section" id="human" aria-labelledby="human-title">
          <div className="am-section__head">
            <p className="am-eyebrow">9 · Human decision</p>
            <h2 className="am-h2" id="human-title">
              The committee decides, not this page
            </h2>
          </div>
          <p>
            This demonstration makes no decision. In a real deployment a named committee would record its decision, its
            reasons and any conditions, and that record would be added to the passport. Here the reviewer is{' '}
            <strong>none (simulated decision)</strong>.
          </p>
          <h3 className="am-h3">Needs human judgment on these inputs</h3>
          <ul>
            {judgment.map((n) => (
              <li key={n.id}>
                {n.label}: {n.note}
              </li>
            ))}
          </ul>
        </section>

        <section className="am-section" id="passport" aria-labelledby="passport-title">
          <div className="am-section__head">
            <p className="am-eyebrow">10 · Decision Passport</p>
            <h2 className="am-h2" id="passport-title">
              A record anyone can reproduce
            </h2>
          </div>
          <p>
            The passport records the sources and their hashes, every input and premise, the calculations, conditions,
            conflicts, open questions and the audit trace, with a SHA-256 integrity hash. Its address encodes all inputs, so it
            reloads identically without a database. Ruleset <span className="am-mono">{RULESET_VERSION}</span>; no AI model.
          </p>
          <p>
            <Link className="am-btn am-btn--gold" href={`/institutional/decision-room/passport/${passportId}`} prefetch={false}>
              Generate Decision Passport for these inputs
            </Link>
          </p>
          <p className="am-tiny">
            Read-only API for this demonstration: <span className="am-mono">GET /api/institutional/decision-room/case</span>,{' '}
            <span className="am-mono">/scenario</span>, <span className="am-mono">/contradictions</span> and{' '}
            <span className="am-mono">/passport/verify</span>, described in the{' '}
            <a href="/api/v1/openapi.json">OpenAPI document</a> (tag <span className="am-mono">institutional-demo</span>).
          </p>
        </section>

        <p className="am-tiny">
          Defaults:{' '}
          {CONTROLS.map((c) => `${c.label} ${DEFAULT_ASSUMPTIONS[c.key]}${c.unit}`).join(' · ')}.
        </p>
      </div>
    </main>
  );
}
