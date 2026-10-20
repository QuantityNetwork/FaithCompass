'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { NAV_SECTIONS, sectionFor } from '@/lib/site/nav';
import { MenuIcon, SearchIcon } from './icons';
import { openPalette } from './theme';
import { ThemeToggle } from './theme-toggle';

/** Logo dimensions (one-line wordmark): 22px high. */
const LOGO_W = 169;
const LOGO_H = 22;

export function SiteHeader() {
  const pathname = usePathname() ?? '/';
  const section = sectionFor(pathname);
  const [open, setOpen] = useState(false);
  const [mod, setMod] = useState('Ctrl');

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) setMod('⌘');
  }, []);

  const subpages = section && section.pages.length > 1 ? section.pages.filter((p) => !p.href.startsWith('/api/')) : null;

  return (
    <header className="am-hdr">
      <div className="am-wrap am-hdr__in">
        <Link href="/" className="am-brand" aria-label="AbrahamMoses home">
          {/* eslint-disable-next-line @next/next/no-img-element -- static SVG */}
          <img className="on-light" src="/brand/abrahammoses-logo.svg" alt="" width={LOGO_W} height={LOGO_H} />
          {/* eslint-disable-next-line @next/next/no-img-element -- static SVG */}
          <img className="on-dark" src="/brand/abrahammoses-logo-ivory.svg" alt="" width={LOGO_W} height={LOGO_H} />
        </Link>
        <nav className={`am-nav${open ? ' is-open' : ''}`} id="am-nav" aria-label="Primary">
          {NAV_SECTIONS.map((s) => {
            const exact = pathname === s.href;
            const inSection = section?.href === s.href;
            return (
              <Link key={s.href} href={s.href} aria-current={exact ? 'page' : inSection ? 'true' : undefined}>
                {s.label}
              </Link>
            );
          })}
        </nav>
        <div className="am-hdr__tools">
          <button type="button" className="am-kbtn" onClick={() => openPalette()} aria-label={`Search the record (${mod} K)`}>
            <SearchIcon />
            <span className="am-kbtn__label">Search the record</span>
            <kbd aria-hidden="true">{mod} K</kbd>
          </button>
          <ThemeToggle />
          <button
            type="button"
            className="am-ibtn am-menu-btn"
            aria-expanded={open}
            aria-controls="am-nav"
            aria-label="Menu"
            onClick={() => setOpen((o) => !o)}
          >
            <MenuIcon />
          </button>
        </div>
      </div>
      {subpages ? (
        <nav className="am-subnav" aria-label={`${section!.label} pages`}>
          <div className="am-wrap am-subnav__in">
            <span className="am-subnav__label" aria-hidden="true">
              {section!.label}
            </span>
            {subpages.map((p) => (
              <Link key={p.href} href={p.href} aria-current={pathname === p.href ? 'page' : undefined}>
                {p.label}
              </Link>
            ))}
          </div>
        </nav>
      ) : null}
    </header>
  );
}
