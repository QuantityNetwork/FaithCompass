import type { Metadata, Viewport } from 'next';
import { CommandPalette } from '@/components/shell/command-palette';
import { SiteFooter } from '@/components/shell/footer';
import { SiteHeader } from '@/components/shell/header';
import { THEME_INIT_SCRIPT } from '@/components/shell/theme';
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, canonicalOrigin } from '@/lib/site/config';
import './fonts.css';
import './globals.css';
import './site.css';
import './ds.css';
import './theme-d.css';
import './tables.css';
import { FONT_VARIABLES, PRELOAD_FONTS } from './fonts';

export const metadata: Metadata = {
  metadataBase: new URL(canonicalOrigin()),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: `${SITE_NAME} editorial (Sagolik)` }],
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
  twitter: { card: 'summary_large_image', title: `${SITE_NAME} — ${SITE_TAGLINE}`, description: SITE_DESCRIPTION },
  alternates: { canonical: '/' },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbf9f4' },
    { media: '(prefers-color-scheme: dark)', color: '#fbf9f4' },
  ],
  colorScheme: 'light dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={FONT_VARIABLES} suppressHydrationWarning>
      <head>
        {PRELOAD_FONTS.map((href) => (
          <link key={href} rel="preload" href={href} as="font" type="font/woff2" crossOrigin="" />
        ))}
        {/* Applies a saved dark-mode choice before first paint. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <SiteHeader />
        {children}
        <SiteFooter />
        <CommandPalette />
      </body>
    </html>
  );
}
