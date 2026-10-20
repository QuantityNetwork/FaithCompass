'use client';

/**
 * Ctrl/⌘-K (or "/") command palette over the published record.
 *
 * The index (/search-index.json) is built from the record compiled into this deployment and
 * loaded on first use; matching runs in the browser, so what a reader types is never sent
 * anywhere. Enter opens the selected record; Ctrl/⌘-Enter (or the first row) takes the
 * question to the research workspace instead.
 */
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SearchItem } from '@/lib/site/search-index';
import { SearchIcon } from './icons';
import { applyTheme, currentTheme } from './theme';

type Row = { kind: 'ask'; q: string } | { kind: 'item'; item: SearchItem } | { kind: 'theme' };

const GROUP_ORDER = ['Research', 'Claims', 'Assumptions', 'Counter-models', 'Traditions', 'Sources', 'Evidence assessments', 'Go to', 'Actions'];

function normalise(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ʿʾ’'‘`]/g, '')
    .toLowerCase();
}

function score(item: SearchItem, terms: string[]): number {
  const title = normalise(item.t);
  const hay = `${title} ${normalise(item.s ?? '')} ${normalise(item.x ?? '')} ${normalise(item.k)}`;
  let sc = 0;
  for (const t of terms) {
    if (!hay.includes(t)) return 0;
    sc += title.includes(t) ? 3 : 1;
  }
  return sc + (item.g === 'Research' ? 2 : 0);
}

function Highlight({ text, terms }: { text: string; terms: string[] }) {
  const usable = terms.filter((t) => t.length > 1);
  if (!usable.length) return <>{text}</>;
  // Match on the normalised text, then map back by position (normalisation keeps length for Latin text).
  const norm = normalise(text);
  if (norm.length !== text.length) return <>{text}</>;
  const marks: Array<[number, number]> = [];
  for (const t of usable) {
    let i = norm.indexOf(t);
    while (i > -1) {
      marks.push([i, i + t.length]);
      i = norm.indexOf(t, i + t.length);
    }
  }
  if (!marks.length) return <>{text}</>;
  marks.sort((a, b) => a[0] - b[0]);
  const out: React.ReactNode[] = [];
  let pos = 0;
  marks.forEach(([s, e], k) => {
    if (s < pos) return;
    if (s > pos) out.push(text.slice(pos, s));
    out.push(<mark key={k}>{text.slice(s, e)}</mark>);
    pos = e;
  });
  out.push(text.slice(pos));
  return <>{out}</>;
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState<SearchItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [sel, setSel] = useState(0);
  const [mod, setMod] = useState('Ctrl');
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const lastFocus = useRef<Element | null>(null);

  const load = useCallback(() => {
    if (index || failed) return;
    fetch('/search-index.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { items: SearchItem[] }) => setIndex(d.items))
      .catch(() => setFailed(true));
  }, [index, failed]);

  const show = useCallback(
    (prefill = '') => {
      lastFocus.current = document.activeElement;
      setQuery(prefill);
      setSel(0);
      setOpen(true);
      load();
    },
    [load],
  );

  const close = useCallback(() => {
    setOpen(false);
    const el = lastFocus.current as HTMLElement | null;
    if (el && typeof el.focus === 'function') setTimeout(() => el.focus(), 0);
  }, []);

  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) setMod('⌘');
    const onOpen = (e: Event) => show((e as CustomEvent<string>).detail || '');
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => {
          if (o) return false;
          lastFocus.current = document.activeElement;
          setQuery('');
          setSel(0);
          load();
          return true;
        });
        return;
      }
      const target = e.target as HTMLElement | null;
      const typing = target && (/^(input|textarea|select)$/i.test(target.tagName) || target.isContentEditable);
      if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        show();
      }
    };
    window.addEventListener('am:palette', onOpen);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('am:palette', onOpen);
      window.removeEventListener('keydown', onKey);
    };
  }, [show, load]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => inputRef.current?.focus(), 10);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const terms = useMemo(() => normalise(query.trim()).split(/\s+/).filter(Boolean), [query]);

  const groups = useMemo(() => {
    const out: Array<{ title: string; rows: Row[] }> = [];
    const q = query.trim();
    if (q) out.push({ title: 'Research', rows: [{ kind: 'ask', q }] });
    if (!index) return out;
    let items: SearchItem[];
    if (!terms.length) {
      items = index.filter((i) => i.g === 'Research' || i.g === 'Go to').slice(0, 14);
    } else {
      items = index
        .map((i) => [score(i, terms), i] as const)
        .filter(([s]) => s > 0)
        .sort((a, b) => b[0] - a[0])
        .slice(0, 30)
        .map(([, i]) => i);
    }
    const byGroup = new Map<string, Row[]>();
    for (const item of items) byGroup.set(item.g, [...(byGroup.get(item.g) ?? []), { kind: 'item', item }]);
    const themeMatch = !terms.length || terms.every((t) => 'dark light ivory navy reading mode theme'.includes(t));
    if (themeMatch) byGroup.set('Actions', [{ kind: 'theme' }]);
    for (const g of GROUP_ORDER) {
      const rows = byGroup.get(g);
      if (!rows) continue;
      const existing = out.find((o) => o.title === g);
      if (existing) existing.rows.push(...rows);
      else out.push({ title: g, rows });
    }
    return out;
  }, [index, terms, query]);

  const flat = useMemo(() => groups.flatMap((g) => g.rows), [groups]);
  const selected = Math.min(sel, Math.max(0, flat.length - 1));

  useEffect(() => {
    listRef.current?.querySelector(`#am-pal-opt-${selected}`)?.scrollIntoView({ block: 'nearest' });
  }, [selected, open]);

  /** Questions are POSTed, so their text never becomes part of an address (see /research/ask). */
  const research = (q: string) => {
    close();
    const form = document.createElement('form');
    form.method = 'post';
    form.action = '/research/ask';
    form.hidden = true;
    const input = document.createElement('input');
    input.name = 'q';
    input.value = q;
    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
  };

  const activate = (row: Row | undefined) => {
    if (!row) {
      if (query.trim()) research(query.trim());
      return;
    }
    if (row.kind === 'ask') return research(row.q);
    if (row.kind === 'theme') {
      applyTheme(currentTheme() === 'light' ? 'dark' : 'light');
      close();
      return;
    }
    close();
    router.push(row.item.u);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSel((selected + 1) % Math.max(1, flat.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSel((selected - 1 + flat.length) % Math.max(1, flat.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if ((e.metaKey || e.ctrlKey) && query.trim()) research(query.trim());
      else activate(flat[selected]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Tab') {
      e.preventDefault();
    }
  };

  if (!open) return null;

  let n = -1;
  return (
    <div
      className="am-pal-back"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="am-pal" role="dialog" aria-modal="true" aria-label="Search the record" onKeyDown={onKeyDown}>
        <div className="am-pal__in">
          <SearchIcon />
          <input
            ref={inputRef}
            autoFocus
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="am-pal-list"
            aria-autocomplete="list"
            aria-activedescendant={flat.length ? `am-pal-opt-${selected}` : undefined}
            aria-label="Search claims, cases, passages and sources, or ask a research question"
            placeholder="Ask a question, cite a passage, find a claim…"
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSel(0);
            }}
          />
          <kbd aria-hidden="true">Esc</kbd>
        </div>
        <div className="am-pal__scroll" ref={listRef}>
        <div className="am-pal__list" id="am-pal-list" role="listbox" aria-label="Results">
          {groups.map((g) => (
            <div role="group" key={g.title} aria-labelledby={`am-pal-g-${g.title.replace(/\W+/g, '-')}`}>
              <div className="am-pal__grp" id={`am-pal-g-${g.title.replace(/\W+/g, '-')}`} role="presentation">
                {g.title}
              </div>
              {g.rows.map((row) => {
                n += 1;
                const i = n;
                const common = {
                  id: `am-pal-opt-${i}`,
                  role: 'option' as const,
                  'aria-selected': i === selected,
                  className: 'am-pal__item',
                  onMouseMove: () => i !== selected && setSel(i),
                  onClick: (e: React.MouseEvent) => {
                    e.preventDefault();
                    activate(row);
                  },
                };
                if (row.kind === 'ask') {
                  return (
                    <div key="ask" {...common}>
                      <span className="am-pal__k">Ask</span>
                      <span>
                        <span className="am-pal__t">Research “{row.q}”</span>
                        <span className="am-pal__s">Open the research workspace with this question · {mod} Enter</span>
                      </span>
                    </div>
                  );
                }
                if (row.kind === 'theme') {
                  return (
                    <div key="theme" {...common}>
                      <span className="am-pal__k">Theme</span>
                      <span className="am-pal__t">Switch between ivory and navy</span>
                    </div>
                  );
                }
                const it = row.item;
                return (
                  <a key={`${it.g}:${it.u}:${it.t}`} href={it.u} {...common}>
                    <span className="am-pal__k">{it.k}</span>
                    <span>
                      <span className="am-pal__t">
                        <Highlight text={it.t} terms={terms} />
                      </span>
                      {it.s ? (
                        <span className="am-pal__s">
                          <Highlight text={it.s.length > 150 ? `${it.s.slice(0, 148)}…` : it.s} terms={terms} />
                        </span>
                      ) : null}
                    </span>
                  </a>
                );
              })}
            </div>
          ))}
        </div>
        <div className="am-pal__msgs" aria-live="polite">
          {!index && !failed ? <p className="am-pal__grp">Loading the record index…</p> : null}
          {failed ? (
            <p className="am-tiny am-pal__empty">The record index could not be loaded. Press Enter to search in the research workspace instead.</p>
          ) : null}
          {index && terms.length > 0 && flat.length <= 1 ? (
            <p className="am-tiny am-pal__empty">
              No record matches every word. Press Enter to open the research workspace anyway; it shows what the record does
              and does not cover.
            </p>
          ) : null}
        </div>
        </div>
        <div className="am-pal__foot" aria-hidden="true">
          <span>
            <kbd>↑</kbd> <kbd>↓</kbd> move
          </span>
          <span>
            <kbd>Enter</kbd> open
          </span>
          <span>
            <kbd>{mod}</kbd> <kbd>Enter</kbd> research this question
          </span>
          <span>Searched in your browser · nothing is sent</span>
        </div>
      </div>
    </div>
  );
}
