'use client';

import { useEffect, useState } from 'react';
import { MoonIcon, SunIcon } from './icons';
import { applyTheme, currentTheme, type Theme } from './theme';

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');
  useEffect(() => {
    setTheme(currentTheme());
    const on = (e: Event) => setTheme((e as CustomEvent<Theme>).detail);
    window.addEventListener('am:theme', on);
    return () => window.removeEventListener('am:theme', on);
  }, []);
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      className="am-ibtn"
      aria-pressed={dark}
      aria-label="Dark mode"
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={() => applyTheme(dark ? 'light' : 'dark')}
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
