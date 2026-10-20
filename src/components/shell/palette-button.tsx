'use client';

import { useEffect, useState } from 'react';
import { openPalette } from './theme';

/** A text button that opens the command palette. */
export function PaletteButton({ children, prefill }: { children: React.ReactNode; prefill?: string }) {
  return (
    <button type="button" onClick={() => openPalette(prefill)}>
      {children}
    </button>
  );
}

/** "Ctrl" or "⌘", chosen in the browser (the server renders "Ctrl"). */
export function ModKey() {
  const [mod, setMod] = useState('Ctrl');
  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) setMod('⌘');
  }, []);
  return <>{mod}</>;
}
