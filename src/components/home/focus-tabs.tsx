'use client';

import { useState, type ReactNode } from 'react';

const TABS = [
  { v: 'all', label: 'All four' },
  { v: 'direct', label: 'Direct evidence' },
  { v: 'interp', label: 'Interpretations' },
  { v: 'infer', label: 'Inferences' },
  { v: 'unres', label: 'Unresolved questions' },
] as const;

/** Dims the other columns so one kind of statement can be read on its own. Purely visual; all text stays in the page. */
export function FocusTabs({ children }: { children: ReactNode }) {
  const [show, setShow] = useState<string>('all');
  return (
    <>
      <div className="d-tabs" role="group" aria-label="Focus on one kind of statement">
        {TABS.map((t) => (
          <button key={t.v} type="button" aria-pressed={show === t.v} onClick={() => setShow(t.v)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="d-cols" data-show={show}>
        {children}
      </div>
    </>
  );
}
