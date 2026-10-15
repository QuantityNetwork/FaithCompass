import type { Metadata } from 'next';
import Link from 'next/link';
import { DependencyExplorer } from '@/components/record/dependency-explorer';
import { ProofConsole } from '@/components/record/proof-console';
import { CodeLink, PageIntro, Section, StatusPill } from '@/components/record/ui';
import { axiomView } from '@/lib/api/views';
import { caseScope } from '@/lib/record/layout';
import { getRecord } from '@/lib/record/record';
import { AXIOM_STANCE_META, DEPENDENCY_META, ROLE_META, type AxiomStance } from '@/lib/record/taxonomy';
import { explorerProps, param, type SearchParams } from '@/lib/site/explorer';

export const metadata: Metadata = {
  title: 'Hermeneutical Dependency Model',
  description:
    'Every conclusion rests on texts, on in-between steps and on a tradition’s reading principles. Reject any of them and see exactly what breaks, what weakens and what still stands.',
  alternates: { canonical: '/hermeneutics' },
};

type Props = { searchParams: Promise<SearchParams> };

export default async function HermeneuticsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const record = getRecord();
  const graph = record.graph();
  const scopeCase = record.researchCase(param(sp, 'scope') ?? '');
  const scope = caseScope(graph, scopeCase ? record.claimsInCase(scopeCase.slug).map((c) => c.code) : graph.claims.map((c) => c.code));
  const basePath = scopeCase ? `/hermeneutics?scope=${scopeCase.slug}` : '/hermeneutics';

  return (
    <main id="main" className="shell page">
      <PageIntro
        eyebrow="Formal model"
        title="Hermeneutical dependency"
        lede="Every conclusion rests on texts, on in-between steps and on a tradition’s reading principles. This page records those dependencies explicitly, so you can see what a doctrine actually relies on — and what follows when any part of it is rejected."
      />

      <Section id="objects" title="The objects" eyebrow="01">
        <div className="grid-3">
          {(Object.keys(ROLE_META) as Array<keyof typeof ROLE_META>).map((r) => (
            <div className="card" key={r}>
              <h3 className="card__title">{ROLE_META[r].label}</h3>
              <p className="small muted" style={{ margin: 0 }}>
                {ROLE_META[r].definition}
              </p>
            </div>
          ))}
          <div className="card">
            <h3 className="card__title">Derivation</h3>
            <p className="small muted" style={{ margin: 0 }}>
              One independent way of arriving at a claim: its premises, each necessary or supporting, and the reading principles
              it requires or is strengthened by. A claim may have several.
            </p>
          </div>
          <div className="card">
            <h3 className="card__title">Tradition axiom</h3>
            <p className="small muted" style={{ margin: 0 }}>
              A reading principle — typology, Torah permanence, an open canon — with each tradition’s recorded stance.
            </p>
          </div>
          <div className="card">
            <h3 className="card__title">Counter-model</h3>
            <p className="small muted" style={{ margin: 0 }}>
              A serious rival reading, credited to whoever holds it, with the principles it relies on and the ones it denies.
            </p>
          </div>
        </div>
        <p className="small faint" style={{ marginTop: 16 }}>
          Dependency types: {Object.values(DEPENDENCY_META).map((d) => d.label.toLowerCase()).join(', ')}.
        </p>
      </Section>

      <Section id="semantics" title="How rejection spreads" eyebrow="02 · Exact semantics">
        <div className="prose-block">
          <ul>
            <li>
              <strong>Derivations are alternatives (OR).</strong> A claim holds while at least one of its derivations holds. A
              conclusion with two independent arguments is not broken by losing one; it is weakened.
            </li>
            <li>
              <strong>Within a derivation, requirements are joint (AND).</strong> Every necessary premise and every required
              principle must hold. Supporting premises and strengthening principles never break a derivation; when they fail,
              the claim is weakened.
            </li>
            <li>
              <strong>Reports are not conclusions.</strong> “Hebrews says X” stands on Hebrews. When the argument that makes X a
              warranted reading fails, the report keeps its standing and loses its warrant — and a derivation that needs X’s
              warrant, not merely the report, fails with it.
            </li>
            <li>
              <strong>Circles prove nothing.</strong> Evaluation is a least fixed point: claims supported only by one another
              are never established.
            </li>
            <li>
              <strong>Map connections stay grounded while any grounding claim holds.</strong>
            </li>
            <li>
              <strong>Disagreement is never resolved by the engine.</strong> Counter-models are shown as aligned with a
              rejection or undermined by it, on both sides.
            </li>
          </ul>
          <p className="small muted">
            These semantics correct the published model, which propagated rejection edge by edge: a conclusion with two
            independent arguments was marked as collapsed when either failed, and a map edge collapsed when one of two
            grounding claims did. The test suite pins the difference against responses captured from the published service.
          </p>
        </div>
      </Section>

      <Section id="explorer-section" title="Rejection analysis" eyebrow="03 · Dependency Explorer">
        <nav className="lane-legend" aria-label="Scope of the graph">
          <Link className="filter-link" href="/hermeneutics#explorer" aria-current={!scopeCase ? 'true' : undefined}>
            Whole record
          </Link>
          {record.data.cases.map((c) => (
            <Link key={c.slug} className="filter-link" href={`/hermeneutics?scope=${c.slug}#explorer`} aria-current={scopeCase?.slug === c.slug ? 'true' : undefined}>
              {c.title}
            </Link>
          ))}
        </nav>
        <DependencyExplorer {...explorerProps(record, { scope, basePath, searchParams: sp })} />
      </Section>

      <Section id="console" title="Proof inspector" eyebrow="04 · Console">
        <p className="small muted" style={{ marginTop: 0 }}>
          The same engine, by command. Try <code className="code-inline">reject AX-2</code>, then{' '}
          <code className="code-inline">inspect 191</code>.
        </p>
        <ProofConsole graph={graph} traditions={record.data.traditions.map((t) => ({ id: t.id, name: t.name }))} />
      </Section>

      <Section id="axioms" title="Reading principles" eyebrow={`05 · ${record.data.axioms.length} axioms`}>
        <div className="stack">
          {record.data.axioms.map((a) => {
            const v = axiomView(record, a.code);
            return (
              <article key={a.code} id={a.code} className="card">
                <div className="claim-card__head">
                  <span className="code-inline">{a.code}</span>
                  <span>{a.heldBy}</span>
                  <StatusPill status={a.status} />
                  {a.stancesStatus === 'provisional' ? <span className="pill pill--provisional">stances provisional</span> : null}
                </div>
                <h3 className="card__title">{a.label}</h3>
                <p style={{ margin: '4px 0' }}>{a.statement}</p>
                <p className="small muted" style={{ margin: '4px 0' }}>
                  {a.rationale}
                </p>
                <p className="small faint" style={{ margin: '6px 0 0' }}>
                  {(['holds', 'qualifies', 'rejects', 'brackets'] as AxiomStance[])
                    .map((s) => {
                      const who = v.stances.filter((x) => x.stance === s).map((x) => x.tradition_name);
                      return who.length ? `${AXIOM_STANCE_META[s].label}: ${who.join(', ')}` : null;
                    })
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                <p className="small" style={{ margin: '6px 0 0' }}>
                  Used by{' '}
                  {v.used_by.length
                    ? v.used_by.map((u, i) => (
                        <span key={`${u.derivation}-${u.claim}`}>
                          {i ? ', ' : ''}
                          <CodeLink code={u.claim} /> ({u.role === 'requires' ? 'required' : 'strengthens'})
                        </span>
                      ))
                    : 'no derivation yet'}
                  {' · '}
                  <a className="link" href={`/hermeneutics?reject=${a.code}#explorer`}>
                    reject it
                  </a>
                </p>
              </article>
            );
          })}
        </div>
      </Section>

      <Section id="counter-models" title="Counter-models" eyebrow={`06 · ${record.data.counterModels.length} rival readings`}>
        <div className="grid-2">
          {record.data.counterModels.map((m) => (
            <article key={m.code} id={m.code} className="card">
              <div className="claim-card__head">
                <span className="code-inline">{m.code}</span>
                <span>{m.strength}</span>
                <StatusPill status={m.status} />
              </div>
              <h3 className="card__title">{m.title}</h3>
              <p className="small muted">{m.heldBy}</p>
              <p>{m.thesis}</p>
              <p className="small faint">
                Contests <CodeLink code={m.targets} />
                {m.position ? (
                  <>
                    {' '}
                    · recorded as position <CodeLink code={m.position} />
                  </>
                ) : null}
                {m.reliesOn.length ? ` · relies on ${m.reliesOn.join(', ')}` : ''}
                {m.rejects.length ? ` · denies ${m.rejects.join(', ')}` : ''}
              </p>
            </article>
          ))}
        </div>
      </Section>
    </main>
  );
}
