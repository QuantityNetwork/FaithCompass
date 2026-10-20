'use client';

import { useEffect, useRef, useState } from 'react';

type Step = { code: string; label: string; output: string; hold?: boolean };

/**
 * A replay of the seven analysis steps over the published record. No model is called and
 * nothing is generated: each step's output is a count the server computed from the records
 * in this dossier. The replay only reveals those counts in order.
 */
export function PipelineReplay({ steps }: { steps: Step[] }) {
  const [shown, setShown] = useState(steps.length);
  const [running, setRunning] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  const replay = () => {
    if (timer.current) clearInterval(timer.current);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setShown(steps.length);
      return;
    }
    setShown(0);
    setRunning(true);
    let i = 0;
    timer.current = setInterval(() => {
      i += 1;
      setShown(i);
      if (i >= steps.length) {
        if (timer.current) clearInterval(timer.current);
        setRunning(false);
      }
    }, 420);
  };

  return (
    <div className="rw-pipe">
      <div className="rw-pipe__head">
        <p className="rw-pipe__note">
          <strong>Replay.</strong> No model is called and no text is generated: each step shows a count computed from the
          published records in this dossier.
        </p>
        <button type="button" className="button" onClick={replay} disabled={running}>
          {running ? 'Replaying…' : 'Replay the steps'}
        </button>
      </div>
      <ol className="rw-pipe__steps">
        {steps.map((s, i) => (
          <li key={s.code} className={`rw-pipe__step${i < shown ? ' is-done' : ''}${s.hold ? ' is-hold' : ''}`} aria-hidden={i >= shown ? true : undefined}>
            <span className="rw-pipe__code">{s.code}</span>
            <span className="rw-pipe__label">{s.label}</span>
            <span className="rw-pipe__out">{s.output}</span>
          </li>
        ))}
      </ol>
      <p className="visually-hidden" aria-live="polite">
        {running ? `Step ${shown} of ${steps.length}` : ''}
      </p>
    </div>
  );
}
