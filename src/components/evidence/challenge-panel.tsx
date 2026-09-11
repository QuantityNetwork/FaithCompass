'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AssessmentChallenge } from '@/lib/evidence/schema';

/**
 * Challenge Assessment.
 *
 * Runs an adversarial pass over the claim and reports what moved. The previous
 * score stays visible next to the revised one — an assessment that quietly
 * changed its mind would be worth less than one that never changed at all.
 */
export function ChallengePanel({
  claimId,
  history,
}: {
  claimId: string;
  history: AssessmentChallenge[];
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AssessmentChallenge | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch(`/api/evidence/claims/${claimId}/challenge`, { method: 'POST' });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
      setResult(body.challenge as AssessmentChallenge);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The challenge could not be completed.');
    } finally {
      setRunning(false);
    }
  }

  const shown = result ? [result, ...history] : history;

  return (
    <div className="panel panel--inset">
      <div className="panel__title">Challenge Assessment</div>
      <p className="small muted" style={{ maxWidth: '62ch', marginTop: 0 }}>
        Identify the weakest assumptions in the current assessment, construct the strongest
        reasonable opposing interpretation, re-examine source quality and independence, and
        re-score. A challenge may raise confidence as well as lower it. The previous score is
        preserved.
      </p>

      <button className="button" onClick={run} disabled={running}>
        {running ? 'Challenging…' : 'Challenge Assessment'}
      </button>

      {error ? (
        <p className="small" style={{ color: '#c98a7a', marginTop: 16 }}>
          {error}
        </p>
      ) : null}

      {shown.length > 0 ? (
        <div style={{ marginTop: 28 }}>
          {shown.map((c) => (
            <ChallengeRecord key={c.id} challenge={c} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ChallengeRecord({ challenge }: { challenge: AssessmentChallenge }) {
  return (
    <div className="notice" style={{ marginTop: 0 }}>
      <div className="tiny" style={{ color: 'var(--gold)', marginBottom: 14 }}>
        Assessment challenged · {challenge.outcome}
      </div>

      <div style={{ display: 'flex', gap: 44, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <div className="profile__label">Previous confidence</div>
          <div className="profile__score" style={{ color: 'var(--ink-muted)' }}>
            {challenge.previousScore ?? '—'}
          </div>
          <div className="tiny faint" style={{ marginTop: 4 }}>
            {challenge.previousLabel}
          </div>
        </div>
        <div>
          <div className="profile__label">Revised confidence</div>
          <div className="profile__score">{challenge.revisedScore ?? '—'}</div>
          <div className="tiny" style={{ marginTop: 4, color: 'var(--gold-bright)' }}>
            {challenge.revisedLabel}
          </div>
        </div>
      </div>

      <Field label="Reason">{challenge.challengeReasoning}</Field>
      <Field label="Strongest opposing case">{challenge.strongestOpposingCase}</Field>
      <Field label="Weakest assumptions">
        <ul className="reasons reasons--neutral" style={{ marginTop: 6 }}>
          {challenge.weakestAssumptions.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      </Field>
      {challenge.sourceQualityFindings.length > 0 ? (
        <Field label="Source quality findings">
          <ul className="reasons reasons--neutral" style={{ marginTop: 6 }}>
            {challenge.sourceQualityFindings.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </Field>
      ) : null}
      <p className="small faint" style={{ marginBottom: 0 }}>
        {challenge.modelProvider} · {challenge.modelVersion} ·{' '}
        {new Date(challenge.createdAt).toISOString().slice(0, 16).replace('T', ' ')}
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div className="compare__row-label" style={{ marginTop: 0 }}>
        {label}
      </div>
      <div className="small">{children}</div>
    </div>
  );
}
