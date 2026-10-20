'use client';

import { useEffect, useState } from 'react';
import { MoonIcon, SunIcon } from './icons';
import { applyTheme, currentTheme, type Theme } from './theme';

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('dark');
  useEffect(() => {
    setTheme(currentTheme());
    const on = (e: Event) => setTheme((e as CustomEvent<Theme>).detail);
    window.addEventListener('am:theme', on);
    return () => window.removeEventListener('am:theme', on);
  }, []);
  const light = theme === 'light';
  return (
    <button
      type="button"
      className="am-ibtn"
      aria-pressed={light}
      aria-label="Ivory reading mode"
      title={light ? 'Switch to the navy theme' : 'Switch to ivory reading mode'}
      onClick={() => applyTheme(light ? 'dark' : 'light')}
    >
      {light ? <MoonIcon /> : <SunIcon />}
    </button>
  );
}
