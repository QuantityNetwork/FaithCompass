'use client';

import { useEffect, useRef } from 'react';

export function PrintButton() {
  return (
    <button type="button" className="button" onClick={() => window.print()}>
      Print
    </button>
  );
}

/** Applies a filter as soon as it changes; the Apply button remains for keyboard and no-JS use. */
export function AutoSubmit({ formId }: { formId: string }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    const on = (e: Event) => {
      if ((e.target as HTMLElement).tagName === 'SELECT') form.requestSubmit();
    };
    form.addEventListener('change', on);
    return () => form.removeEventListener('change', on);
  }, [formId]);
  return null;
}
