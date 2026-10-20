import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DecisionTwinLogo } from '@/components/decision/brand';
import { PrintButton } from '@/components/decision/print-button';
import { ClassChip, ConditionChip, SyntheticNotice } from '@/components/decision/ui';
import type { ConditionStatus } from '@/lib/decision/engine';
import { PassportIdError, UnsupportedVersionError, buildPassport } from '@/lib/decision/passport';

export const metadata: Metadata = {
  title: 'Decision Passport (synthetic)',
  description: 'A reproducible record of a simulated decision on a fictional credit facility.',
  robots: { index: false },
};

function load(id: string): { passport: ReturnType<typeof buildPassport> } | { unsupported: string } | null {
  try {
    return { passport: buildPassport(id) };
  } catch (err) {
    if (err instanceof UnsupportedVersionError) return { unsupported: err.message };
    if (err instanceof PassportIdError) return null;
    throw err;
  }
}

export default async function PassportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loaded = load(decodeURIComponent(id));
  if (!loaded) notFound();
  if ('unsupported' in loaded) {
    return (
      <main id="main" className="am-page dr dr-passport">
        <div className="am-wrap">
          <header className="am-page__head">
            <p className="am-eyebrow">Decision Passport</p>
            <h1 className="am-h1">Unsupported passport version</h1>
          </header>
          <p className="am-note" role="alert">
            {loaded.unsupported}
          </p>
          <p>
            <Link href="/institutional/decision-room">Back to the Decision Room</Link>
          </p>
        </div>
      </main>
    );
  }
  const p = loaded.passport;
  const sig = p.integrity.signature;
  const base = `/institutional/decision-room/passport/${p.id}`;

  return (
    <main id="main" className="am-page dr dr-passport">
      <div className="am-wrap">
        <header className="am-page__head">
          <div className="dt-brand">
            <DecisionTwinLogo height={96} />
          </div>
          <p className="am-eyebrow">AbrahamMoses Decision Twin · Decision Passport · Simulated</p>
          <h1 className="am-h1">{p.title}</h1>
          <SyntheticNotice />
        </header>

        <dl className="dr-meta">
          <dt>Passport ID</dt>
          <dd className="am-mono dr-hash">{p.id}</dd>
          <dt>Generated</dt>
          <dd>{p.generated_at}</dd>
          <dt>Case</dt>
          <dd>
            {p.case.id} v{p.case.version} · {p.case.borrower}
          </dd>
          <dt>Question</dt>
          <dd>{p.case.question}</dd>
          <dt>Status</dt>
          <dd>{p.status}</dd>
          <dt>Reviewer</dt>
          <dd>{p.reviewer}</dd>
          <dt>Versions</dt>
          <dd>
            Ruleset {p.versions.ruleset}; configuration {p.versions.configuration}; model: {p.versions.model}; format {p.versions.passport_format}
          </dd>
          <dt>SHA-256</dt>
          <dd className="am-mono dr-hash">{p.integrity.sha256}</dd>
          <dt>Signature</dt>
          <dd>
            {sig.status === 'signed' ? (
              <>
                Ed25519, key <span className="am-mono">{sig.key_id}</span> (<a href={sig.public_keys}>public keys</a>):{' '}
                <span className="am-mono dr-hash">{sig.value}</span>
              </>
            ) : (
              sig.status
            )}
          </dd>
          <dt>Case data</dt>
          <dd>
            Archived version {p.integrity.case_archive.version}, SHA-256{' '}
            <span className="am-mono dr-hash">{p.integrity.case_archive.content_sha256}</span>
            {p.case.content_sha256 ? null : ' (format 1 passport: the hash is checked on rebuild but not recorded in its content)'}
          </dd>
        </dl>
        <p className="am-note">{p.integrity_note}</p>
        <p className="am-note">{p.legal_note}</p>

        <div className="dr-actions dr-noprint">
          <a className="am-btn" href={`${base}/json`}>
            Download JSON
          </a>
          <a className="am-btn" href={`${base}/markdown`}>
            Download Markdown
          </a>
          <PrintButton />
          <a className="am-btn" href={`/api/institutional/decision-room/passport/verify?id=${p.id}&sha256=${p.integrity.sha256}`}>
            Verify hash
          </a>
          <Link className="am-btn" href="/institutional/decision-room">
            Back to the Decision Room
          </Link>
        </div>

        <section className="am-section" aria-labelledby="p-conclusion">
          <h2 className="am-h2" id="p-conclusion">
            Conclusion
          </h2>
          <p>{p.conclusion}</p>
          <div className="table-wrap">
            <table className="table table--stack">
              <caption className="am-sr">Conditions</caption>
              <thead>
                <tr>
                  <th scope="col">Condition</th>
                  <th scope="col">Status</th>
                  <th scope="col">Note</th>
                </tr>
              </thead>
              <tbody>
                {p.conditions.map((c) => (
                  <tr key={c.id}>
                    <td data-label="Condition">{c.label}</td>
                    <td data-label="Status">
                      <ConditionChip status={c.status as ConditionStatus} />
                    </td>
                    <td data-label="Note">{c.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3 className="am-h3">Open questions for human judgment</h3>
          <ul>
            {p.open_questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </section>

        <section className="am-section" aria-labelledby="p-assumptions">
          <h2 className="am-h2" id="p-assumptions">
            Assumptions, premises and scenarios
          </h2>
          <ul>
            <li>Revenue growth {p.assumptions.growth}% · EBITDA margin {p.assumptions.margin}% · total debt ${p.assumptions.debt}M · interest ${p.assumptions.interest}M</li>
            <li>Covenant ceiling {p.assumptions.covMax}x · minimum liquidity ${p.assumptions.minLiq}M · top customer {p.assumptions.concentration}%</li>
            <li>Documents treated as verified: {p.assumptions.verified.join(', ') || 'none'}</li>
            {p.premises.map((x) => (
              <li key={x.id}>
                {x.id} {x.accepted ? 'accepted' : 'rejected'}: {x.statement}
              </li>
            ))}
            <li>
              Base: leverage {p.scenarios.base.leverage}, coverage {p.scenarios.base.coverage}. Stress: EBITDA {p.scenarios.stress.ebitda}, leverage{' '}
              {p.scenarios.stress.leverage}, coverage {p.scenarios.stress.coverage}.
            </li>
          </ul>
        </section>

        <section className="am-section" aria-labelledby="p-config">
          <h2 className="am-h2" id="p-config">
            Decision configuration (snapshot)
          </h2>
          <dl className="dr-meta">
            <dt>Configuration</dt>
            <dd className="am-mono">{p.configuration.version}</dd>
            <dt>Objective</dt>
            <dd>{p.configuration.objective}</dd>
            <dt>Evidence standard</dt>
            <dd>{p.configuration.evidence_standard}</dd>
            <dt>Approval policy</dt>
            <dd>
              {p.configuration.approval_policy.actions.join(' / ')}. {p.configuration.approval_policy.rule}
            </dd>
            <dt>Escalation rules</dt>
            <dd>
              <ul>
                {p.configuration.escalation_rules.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </dd>
            <dt>Monitoring triggers</dt>
            <dd>
              <ul>
                {p.configuration.monitoring_triggers.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </dd>
          </dl>
          <ul>
            {p.configuration.assumptions.map((x) => (
              <li key={x.label}>
                <span className="am-mono">{x.state.toLowerCase()}</span> · {x.label}: {x.value} ({x.source})
              </li>
            ))}
          </ul>
        </section>

        <section className="am-section" aria-labelledby="p-calc">
          <h2 className="am-h2" id="p-calc">
            Calculations
          </h2>
          <div className="table-wrap">
            <table className="table table--stack">
              <caption className="am-sr">Calculations</caption>
              <thead>
                <tr>
                  <th scope="col">Measure</th>
                  <th scope="col">Value</th>
                  <th scope="col">Formula</th>
                </tr>
              </thead>
              <tbody>
                {p.calculations.map((c) => (
                  <tr key={c.id}>
                    <td data-label="Measure">{c.label}</td>
                    <td data-label="Value" className="mono">
                      {c.display}
                    </td>
                    <td data-label="Formula">{c.formula}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="am-section" aria-labelledby="p-claims">
          <h2 className="am-h2" id="p-claims">
            Arguments (Adversarial Chamber, deterministic rules)
          </h2>
          <ul>
            {p.claims.map((c) => (
              <li key={c.id}>
                <strong>{c.side.toLowerCase()}</strong>: {c.text}
              </li>
            ))}
          </ul>
          <h3 className="am-h3">Conflicts and evidence gaps</h3>
          <ul>
            {p.conflicts.map((c) => (
              <li key={c.id}>
                <span className="am-mono">{c.id}</span> {c.title} <ClassChip cls={c.class} /> {c.human_action}
              </li>
            ))}
          </ul>
          {p.warnings.length ? (
            <>
              <h3 className="am-h3">Active warnings</h3>
              <ul>
                {p.warnings.map((w) => (
                  <li key={w.id}>
                    {w.label}: {w.note}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>

        <section className="am-section" aria-labelledby="p-sources">
          <h2 className="am-h2" id="p-sources">
            Source inventory
          </h2>
          <div className="table-wrap">
            <table className="table table--stack">
              <caption className="am-sr">Sources with hashes</caption>
              <thead>
                <tr>
                  <th scope="col">ID</th>
                  <th scope="col">Title</th>
                  <th scope="col">Recorded status</th>
                  <th scope="col">SHA-256</th>
                </tr>
              </thead>
              <tbody>
                {p.sources.map((s) => (
                  <tr key={s.id}>
                    <td data-label="ID" className="mono">
                      {s.id}
                    </td>
                    <td data-label="Title">{s.title}</td>
                    <td data-label="Recorded status">{s.verification}</td>
                    <td data-label="SHA-256" className="mono dr-hash">
                      {s.sha256}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="am-section" aria-labelledby="p-audit">
          <h2 className="am-h2" id="p-audit">
            Audit history and reproducibility
          </h2>
          <ul>
            {p.audit_history.map((h, i) => (
              <li key={i}>
                {h.at} · {h.event}: {h.detail}
              </li>
            ))}
          </ul>
          <p className="am-tiny">{p.reproducibility}</p>
        </section>
      </div>
    </main>
  );
}
