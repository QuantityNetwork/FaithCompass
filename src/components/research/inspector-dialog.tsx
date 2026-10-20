'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, type ReactNode } from 'react';

/**
 * The inspector as a modal drawer. It is server-rendered (the URL carries ?inspect=CODE,
 * so it works without JavaScript and every inspected claim has an address); this client
 * shell adds focus management: focus moves into the drawer, Tab stays inside it, Esc or
 * Close returns to the dossier and puts focus back on the statement that opened it.
 */
export function InspectorDialog({ code, closeHref, children }: { code: string; closeHref: string; children: ReactNode }) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    router.push(closeHref, { scroll: false });
  }, [router, closeHref]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.querySelector<HTMLElement>('.ins-dlg__title')?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== 'Tab') return;
      const f = [...el.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex="0"], [tabindex="-1"].ins-dlg__title')].filter(
        (x) => x.offsetParent !== null || x === document.activeElement,
      );
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || !el.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      // Return focus to the statement that opened the inspector, once the dossier has re-rendered.
      const back = () => {
        const t = document.querySelector<HTMLElement>(`[data-inspect-trigger="${code}"]`) ?? document.querySelector<HTMLElement>('#rw-title');
        t?.focus();
      };
      requestAnimationFrame(() => requestAnimationFrame(back));
    };
  }, [code, close]);

  return (
    <div className="ins-dlg" role="presentation">
      <Link href={closeHref} scroll={false} className="ins-dlg__scrim" aria-hidden="true" tabIndex={-1} />
      <div ref={ref} className="ins-dlg__panel" role="dialog" aria-modal="true" aria-labelledby="ins-dlg-title">
        <div className="ins-dlg__head">
          <div>
            <p className="eyebrow" style={{ margin: 0 }}>
              Evidence inspector
            </p>
            <h2 id="ins-dlg-title" className="ins-dlg__title" tabIndex={-1}>
              {code}
            </h2>
          </div>
          <Link href={closeHref} scroll={false} className="ins-dlg__close" aria-label="Close the inspector (Esc)">
            Close <kbd aria-hidden="true">Esc</kbd>
          </Link>
        </div>
        <div className="ins-dlg__body">{children}</div>
      </div>
    </div>
  );
}
