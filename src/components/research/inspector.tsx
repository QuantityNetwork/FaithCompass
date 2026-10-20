/**
 * The evidence inspector (master prompt §6.3): the nine parts of one record statement,
 * rendered on the server from the published record. Nothing is generated; every empty
 * part says that the record holds nothing for it.
 */
import Link from 'next/link';
import type { ReactNode } from 'react';
import { OutcomeChip, ReviewChip } from '@/components/ds/status';
import type { Outcomes } from '@/lib/research/dossier';
import { claimPermalink } from '@/lib/research/dossier';
import type { AbrahamMosesRecord } from '@/lib/record/record';
import type { Reference } from '@/lib/record/schema';
import { ACCEPTANCE_META, CLASSIFICATION_META, isEditorVerified } from '@/lib/record/taxonomy';

const LANG: Record<string, string> = { hebrew: 'he', greek: 'grc', arabic: 'ar', syriac: 'syc', aramaic: 'arc', latin: 'la' };
function langOf(language: string | undefined): string | undefined {
  if (!language) return undefined;
  const k = Object.keys(LANG).find((l) => language.toLowerCase().includes(l));
  return k ? LANG[k] : undefined;
}
const RTL = new Set(['he', 'ar', 'syc', 'arc']);

function Part({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="ins-part" aria-labelledby={`ins-p${n}`}>
      <h3 id={`ins-p${n}`} className="ins-part__title">
        <span aria-hidden="true">{n}</span> {title}
      </h3>
      <div className="ins-part__body">{children}</div>
    </section>
  );
}

function None({ children }: { children: ReactNode }) {
  return <p className="ins-none">{children}</p>;
}

export function InspectorBody({
  record,
  code,
  out,
  origin,
  inDossier,
}: {
  record: AbrahamMosesRecord;
  code: string;
  out: Outcomes;
  origin: string;
  inDossier: (c: string) => string;
}) {
  const claim = record.claim(code)!;
  const r = record.current(claim);
  const cls = CLASSIFICATION_META[r.classification];
  const permalink = claimPermalink(record, code);
  const refHref = (ref: Reference) => `/corpus#${record.work(ref.work)?.category ?? ''}`;

  const works = [...new Set([...r.primaryWitnesses, ...r.evidence.map((e) => e.reference)].map((w) => w.work))]
    .map((w) => record.work(w))
    .filter((w): w is NonNullable<typeof w> => Boolean(w));
  const originals = r.quotations.filter((q) => q.translation === null);
  const translated = r.quotations.filter((q) => q.translation !== null);
  const concluding = record.data.derivations.filter((d) => d.claim === code);
  const supports = record.data.derivations.filter((d) => d.premises.some((p) => p.claim === code));
  const counters = record.counterModelsFor(code);
  const contested = r.acceptance.filter((a) => a.stance === 'qualifies' || a.stance === 'disputes' || a.stance === 'rejects');
  const affirming = r.acceptance.filter((a) => a.stance === 'affirms');
  const axioms = [...new Map(concluding.flatMap((d) => d.axioms.map((a) => [a.axiom, a] as const))).values()];
  const reviewers = r.editorial.reviewers;

  return (
    <div className="ins">
      <Part n={1} title="Exact claim">
        <p className="ins-statement">{r.statement}</p>
        <p className="ins-meta">
          <span className="mono">
            {code} · revision {r.rev}
          </span>{' '}
          · <span title={cls.definition}>{cls.label}</span>
        </p>
        <p className="ins-chips">
          <ReviewChip status={r.status} />
          <OutcomeChip status={out.claim(code)} />
        </p>
        <p className="ins-cite">
          <span className="ins-label">Permanent citation</span>
          <a href={permalink}>
            {origin}
            {permalink}
          </a>
        </p>
      </Part>

      <Part n={2} title="Cited passage">
        <ul className="ins-list">
          {r.primaryWitnesses.map((w) => (
            <li key={`w-${w.work}-${w.locator}`}>
              <Link href={refHref(w)}>{w.display}</Link> <span className="ins-faint">primary witness</span>
            </li>
          ))}
          {r.evidence.map((e) => (
            <li key={`e-${e.reference.work}-${e.reference.locator}`}>
              <Link href={refHref(e.reference)}>{e.reference.display}</Link>
              {e.note ? <span className="ins-faint"> — {e.note}</span> : null}
            </li>
          ))}
        </ul>
      </Part>

      <Part n={3} title="Source edition">
        {works.length ? (
          <ul className="ins-list">
            {works.map((w) => (
              <li key={w.id}>
                <Link href={`/corpus#${w.category}`}>{w.title}</Link>
                <span className="ins-faint">
                  {' '}
                  — {w.edition.title}
                  {w.edition.publisher ? `, ${w.edition.publisher}` : ''}
                  {w.edition.year ? ` (${w.edition.year})` : ''} · {w.edition.language}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <None>No edition is recorded for the cited works.</None>
        )}
      </Part>

      <Part n={4} title="Original-language text">
        {originals.length ? (
          originals.map((q, i) => {
            const lang = langOf(record.work(q.reference.work)?.edition.language);
            return (
              <blockquote key={i} className="ins-quote">
                <p lang={lang} dir={lang && RTL.has(lang) ? 'rtl' : undefined}>
                  {q.text}
                </p>
                <footer>{q.reference.display}</footer>
              </blockquote>
            );
          })
        ) : (
          <None>
            This revision quotes no original-language text. The cited editions are listed above; passages are quoted
            only where the record holds a licensed or public-domain text.
          </None>
        )}
      </Part>

      <Part n={5} title="Translation differences">
        {translated.length || r.variants.length ? (
          <ul className="ins-list">
            {translated.map((q, i) => {
              const t = record.data.translations.find((x) => x.id === q.translation);
              return (
                <li key={`t${i}`}>
                  <q>{q.text}</q> <span className="ins-faint">— {q.reference.display}, {t?.name ?? q.translation}</span>
                  {t && !t.verified ? <span className="ins-flag"> Quotation not yet checked by an editor.</span> : null}
                </li>
              );
            })}
            {r.variants.map((v, i) => (
              <li key={`v${i}`}>
                <span className="ins-label">Variant · {v.bearing} bearing</span> {v.reference.display}: {v.description}
              </li>
            ))}
          </ul>
        ) : (
          <None>No translation difference or textual variant is recorded for this claim.</None>
        )}
      </Part>

      <Part n={6} title="Supporting and opposing arguments">
        {concluding.length || supports.length || counters.length || r.acceptance.length ? (
          <>
            {concluding.map((d) => (
              <div key={d.code} className="ins-arg">
                <p className="ins-label">
                  Argued by <span className="mono">{d.code}</span> · {out.derivationValid(d.code) ? 'holds' : 'fails'} under the selected
                  assumptions
                </p>
                <ul className="ins-list">
                  {d.premises.map((p) => (
                    <li key={p.claim}>
                      <Link href={inDossier(p.claim)} scroll={false}>
                        {p.claim}
                      </Link>{' '}
                      <span className="ins-faint">
                        ({p.necessity}) {record.claim(p.claim)?.topic}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {supports.length ? (
              <p className="ins-small">
                <span className="ins-label">Used as a premise by</span>{' '}
                {supports.map((d, i) => (
                  <span key={d.code}>
                    {i ? ', ' : ''}
                    <Link href={inDossier(d.claim)} scroll={false}>
                      {d.claim}
                    </Link>
                  </span>
                ))}
              </p>
            ) : null}
            {counters.map((m) => (
              <div key={m.code} className="ins-arg ins-arg--counter">
                <p className="ins-label">
                  Counter-model <span className="mono">{m.code}</span> · {m.heldBy}
                </p>
                <p className="ins-small">
                  <Link href={`/hermeneutics#${m.code}`}>{m.title}</Link>: {m.thesis}
                </p>
              </div>
            ))}
            {affirming.length || contested.length ? (
              <ul className="ins-list">
                {[...affirming, ...contested].map((a) => (
                  <li key={a.tradition}>
                    <span className="ins-label">{ACCEPTANCE_META[a.stance].label}</span> {record.tradition(a.tradition)?.name ?? a.tradition}
                    {a.note ? <span className="ins-faint"> — {a.note}</span> : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : (
          <None>No argument, counter-model or tradition stance is recorded for this claim.</None>
        )}
      </Part>

      <Part n={7} title="Assumptions">
        {axioms.length ? (
          <ul className="ins-list">
            {axioms.map((a) => (
              <li key={a.axiom}>
                <Link className="mono" href={`/hermeneutics#${a.axiom}`}>
                  {a.axiom}
                </Link>{' '}
                {record.axiom(a.axiom)?.label}{' '}
                <span className="ins-faint">({a.role === 'requires' ? 'required' : 'strengthens'})</span>
              </li>
            ))}
          </ul>
        ) : (
          <None>No declared assumption: this claim is grounded in its witnesses, not derived.</None>
        )}
      </Part>

      <Part n={8} title="Review history">
        <ol className="ins-list ins-history">
          {[...claim.revisions].reverse().map((rev) => (
            <li key={rev.rev}>
              <span className="mono">rev {rev.rev}</span> · {rev.publishedAt} · <ReviewChip status={rev.status} short />
              <span className="ins-faint"> — {rev.editorial.changeNote}</span>
            </li>
          ))}
        </ol>
        <p className="ins-small">
          Author: {r.editorial.author}.{' '}
          {reviewers.length
            ? `Reviewed by ${reviewers.map((x) => `${x.name} (${x.role})`).join(', ')}.`
            : isEditorVerified(r.status)
              ? ''
              : 'No reviewer is named on this revision: it has not been editor-verified, and no external review is recorded.'}{' '}
          Machine involvement: {r.machine.level.replace('_', ' ')} — {r.machine.description}
        </p>
      </Part>

      <Part n={9} title="Known limitations">
        <ul className="ins-list">
          <li>
            <span className="ins-label">Disputed</span> {r.disputed}
          </li>
          {r.interpretiveDivergence ? (
            <li>
              <span className="ins-label">Interpretive divergence</span> {r.interpretiveDivergence}
            </li>
          ) : null}
          {r.machine.verification === 'pending' ? <li>Machine-assisted material on this revision awaits verification.</li> : null}
        </ul>
        <p className="ins-small">
          <Link href={`/claims/${code}`}>Open the full claim page</Link> ·{' '}
          <Link href={`/claims/${code}#provenance`}>provenance chain</Link> ·{' '}
          <a href={`/api/v1/claims/${code}?rev=${r.rev}`}>JSON</a>
        </p>
      </Part>
    </div>
  );
}
