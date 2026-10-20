/** Theme persistence: ivory ("light") by default, navy ("dark") on request, remembered per browser. */
export const THEME_KEY = 'am-theme';
export type Theme = 'light' | 'dark';

/** Runs in <head> before first paint, so a returning dark-mode reader never sees an ivory flash. */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem('${THEME_KEY}');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t)}catch(e){}`;

export function currentTheme(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

export function applyTheme(t: Theme) {
  document.documentElement.setAttribute('data-theme', t);
  try {
    localStorage.setItem(THEME_KEY, t);
  } catch {
    /* private mode: the choice lasts for this page only */
  }
  window.dispatchEvent(new CustomEvent('am:theme', { detail: t }));
}

/** Opens the command palette from anywhere (buttons, links, shortcuts). */
export function openPalette(prefill?: string) {
  window.dispatchEvent(new CustomEvent('am:palette', { detail: prefill ?? '' }));
}
