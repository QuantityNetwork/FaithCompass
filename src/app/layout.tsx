import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'AbrahamMoses — Structured Theological Intelligence',
    template: '%s · AbrahamMoses',
  },
  description:
    'Evidence Intelligence: how strongly is a specific theological, textual, historical or archaeological claim actually supported — and how certain should we be?',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
