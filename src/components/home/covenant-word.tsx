'use client';

/**
 * The home page's graphic: the word "covenant" in Hebrew, Greek and Arabic, cycling slowly.
 * Click (or a dot) to step; never moves on its own when the reader prefers reduced motion.
 */
import { useEffect, useRef, useState } from 'react';

const WORDS = [
  { text: 'בְּרִית', cls: 'he', lang: 'he', translit: 'berit', name: 'Hebrew' },
  { text: 'διαθήκη', cls: 'gr', lang: 'grc', translit: 'diathēkē', name: 'Greek' },
  { text: 'مِيثَاق', cls: 'ar', lang: 'ar', translit: 'mīthāq', name: 'Arabic' },
] as const;

export function CovenantWord() {
  const [i, setI] = useState(0);
  const [out, setOut] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const reduced = useRef(false);

  const show = (n: number) => {
    if (reduced.current) {
      setI(n);
      return;
    }
    setOut(true);
    setTimeout(() => {
      setI(n);
      setOut(false);
    }, 320);
  };

  useEffect(() => {
    // The study glyphs further down set Greek and Arabic faces; they are revealed once the page
    // is interactive, so those font files never compete with the first paint.
    const reveal = () => document.documentElement.classList.add('am-glyphs');
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    if (idle) idle(reveal);
    else setTimeout(reveal, 200);
  }, []);

  useEffect(() => {
    reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced.current) return;
    timer.current = setInterval(() => {
      setOut(true);
      setTimeout(() => {
        setI((x) => (x + 1) % WORDS.length);
        setOut(false);
      }, 320);
    }, 4200);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };
  const w = WORDS[i];

  return (
    <div className="d-script">
      <button
        type="button"
        className="d-script__word-btn"
        onClick={() => {
          stop();
          show((i + 1) % WORDS.length);
        }}
        aria-label={`“Covenant” in ${w.name}: ${w.translit}. Show the next language`}
      >
        <span className={`d-script__word ${w.cls}${out ? ' is-out' : ''}`} lang={w.lang} aria-hidden="true">
          {w.text}
        </span>
      </button>
      <span className="d-script__rule" aria-hidden="true" />
      <p className="d-script__cap" aria-live="polite">
        <b>{w.translit}</b> · {w.name} · “covenant”
      </p>
      <div className="d-script__dots" role="group" aria-label="Show the word covenant in">
        {WORDS.map((x, n) => (
          <button
            key={x.name}
            type="button"
            aria-pressed={n === i}
            aria-label={x.name}
            onClick={() => {
              stop();
              show(n);
            }}
          />
        ))}
      </div>
    </div>
  );
}
