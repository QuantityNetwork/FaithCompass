'use client';

import { useEffect } from 'react';

export function PrintButton() {
  return (
    <button type="button" className="button" onClick={() => window.print()}>
      Print
    </button>
  );
}

/**
 * Applies a filter as soon as it changes; the Apply button remains for keyboard and no-JS use.
 *
 * A select changed before hydration fires its change event before this listener exists, so on
 * mount any select whose value differs from its server-rendered default is applied at once.
 */
export function AutoSubmit({ formId }: { formId: string }) {
  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    const changedBeforeHydration = Array.from(form.querySelectorAll('select')).some((select) => {
      const initial = Array.from(select.options).find((o) => o.defaultSelected) ?? select.options[0];
      return initial !== undefined && select.value !== initial.value;
    });
    if (changedBeforeHydration) form.requestSubmit();
    const on = (e: Event) => {
      if ((e.target as HTMLElement).tagName === 'SELECT') form.requestSubmit();
    };
    form.addEventListener('change', on);
    return () => form.removeEventListener('change', on);
  }, [formId]);
  return null;
}
