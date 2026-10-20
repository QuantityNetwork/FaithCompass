/**
 * Browser acceptance tests against the production build.
 *
 *   npm run build && npm run test:e2e
 *
 * Starts `next start` on a free port (or uses E2E_BASE_URL) and drives it with
 * Chromium: server-rendered content without JavaScript, phone-width layout,
 * keyboard operation of the Dependency Explorer, local-only research traces,
 * and an axe-core WCAG 2.2 AA scan of the main pages.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '../..');
let base = process.env.E2E_BASE_URL ?? '';
let server: ChildProcess | null = null;
let browser: Browser;

async function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const s = createServer();
    s.listen(0, () => {
      const port = (s.address() as { port: number }).port;
      s.close(() => resolve(port));
    });
  });
}

beforeAll(async () => {
  if (!base) {
    if (!existsSync(join(ROOT, '.next', 'BUILD_ID'))) throw new Error('No production build. Run `npm run build` first.');
    const port = await freePort();
    base = `http://localhost:${port}`;
    server = spawn(join(ROOT, 'node_modules/.bin/next'), ['start', '-p', String(port)], {
      cwd: ROOT,
      env: { ...process.env, ABRAHAMMOSES_PUBLIC_ORIGIN: base, NEXT_TELEMETRY_DISABLED: '1' },
      stdio: 'ignore',
    });
    for (let i = 0; i < 60; i++) {
      try {
        if ((await fetch(`${base}/api/v1`)).ok) break;
      } catch {
        /* not yet listening */
      }
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined) });
});

afterAll(async () => {
  await browser?.close();
  server?.kill();
});

async function page(opts: Parameters<Browser['newContext']>[0] = {}): Promise<{ context: BrowserContext; page: Page; errors: string[] }> {
  const context = await browser.newContext(opts);
  const p = await context.newPage();
  const errors: string[] = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return { context, page: p, errors };
}

const PAGES = [
  '/',
  '/research',
  '/research?q=What%20changed%20concerning%20priesthood%20under%20the%20New%20Covenant%3F',
  '/research/torah-permanence',
  '/research/priesthood-new-covenant',
  '/research/ibrahim-heirs-and-revelation',
  '/research/restoration-priesthood-authority',
  '/claims',
  '/claims/AM-CLAIM-000191',
  '/covenants',
  '/doctrine',
  '/traditions',
  '/traditions/rabbinic-judaism',
  '/compare',
  '/hermeneutics',
  '/corpus',
  '/methodology',
  '/system',
  '/about',
  '/changelog',
  '/developers',
  '/status',
  '/privacy',
  '/terms',
  '/evidence',
];

describe('server-rendered content', () => {
  it('delivers the record in the HTML, with no loading placeholders', async () => {
    const checks: Array<[string, string]> = [
      ['/claims', 'Hebrews identifies Jesus as High Priest according to the order of Melchizedek.'],
      ['/claims/AM-CLAIM-000191', 'The Melchizedekian priesthood of Christ supersedes the Levitical priesthood'],
      ['/covenants', 'The Noahic covenant preserves the created order'],
      ['/doctrine', 'Melchizedek blesses Abram and receives a tithe'],
      ['/hermeneutics', 'Apostolic exegesis is authoritative'],
      ['/research/ibrahim-heirs-and-revelation', 'neither a Jew nor a Christian'],
    ];
    for (const [path, text] of checks) {
      const html = await (await fetch(`${base}${path}`)).text();
      expect(html, path).toContain(text.replace(/'/g, '&#x27;').split('&#x27;')[0]);
      expect(html.toLowerCase(), path).not.toMatch(/loading the record|loading graph|loading…/);
    }
  });

  it('renders a simulation server-side from the URL, so a shared link works without JavaScript', async () => {
    const { context, page: p } = await page({ javaScriptEnabled: false });
    await p.goto(`${base}/research/priesthood-new-covenant`);
    await p.getByRole('button', { name: /AM-AX-002/ }).first().click();
    await p.waitForURL(/reject=AM-AX-002/);
    await expect(p.getByRole('status').first().textContent()).resolves.toMatch(/Rejected AM-AX-002/);
    await context.close();
  });

  it('serves canonical links, a sitemap with every claim, and robots rules', async () => {
    const html = await (await fetch(`${base}/claims/AM-CLAIM-000184`)).text();
    expect(html).toContain(`<link rel="canonical" href="${base}/claims/AM-CLAIM-000184"/>`);
    const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
    expect(sitemap).toContain(`${base}/claims/AM-CLAIM-000274`);
    expect(sitemap).toContain(`${base}/research/torah-permanence`);
    const robots = await (await fetch(`${base}/robots.txt`)).text();
    expect(robots).toContain('Disallow: /api/');
    expect(robots).toContain(`Sitemap: ${base}/sitemap.xml`);
  });
});

describe('layout', () => {
  it('has no horizontal overflow at phone width', async () => {
    const { context, page: p } = await page({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true });
    for (const path of PAGES) {
      await p.goto(`${base}${path}`);
      const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, path).toBeLessThanOrEqual(1);
    }
    await context.close();
  });

  it('loads every main page without console errors', async () => {
    const { context, page: p, errors } = await page();
    for (const path of PAGES) {
      await p.goto(`${base}${path}`, { waitUntil: 'networkidle' });
    }
    expect(errors).toEqual([]);
    await context.close();
  });
});

describe('Dependency Explorer', () => {
  it('recalculates from the keyboard, keeps the rival position standing, and updates the URL', async () => {
    const { context, page: p } = await page();
    await p.goto(`${base}/research/priesthood-new-covenant`);
    const toggle = p.getByRole('button', { name: /AM-AX-002/ }).first();
    await toggle.focus();
    await p.keyboard.press('Space');
    await expect.poll(() => p.getByRole('status').first().textContent()).toMatch(/Rejected AM-AX-002/);
    expect(p.url()).toContain('reject=AM-AX-002');
    await expect(toggle.getAttribute('aria-pressed')).resolves.toBe('true');

    // The supersession thesis survives on its second derivation; the rival position is untouched.
    const positions = p.locator('#explorer .position');
    await expect(positions.filter({ hasText: 'AM-CLAIM-000191' }).first().textContent()).resolves.toMatch(/Support weakened/);
    await expect(positions.filter({ hasText: 'AM-CLAIM-000197' }).first().textContent()).resolves.toMatch(/Supported under selected assumptions/);

    // Graph nodes are reachable by keyboard and open the inspector.
    const node = p.locator('g.graph-node[aria-label^="AM-CLAIM-000191"]');
    await node.focus();
    await p.keyboard.press('Enter');
    await expect(p.locator('.inspector').textContent()).resolves.toMatch(/still holds/);
    await context.close();
  });

  it('applies a tradition lens', async () => {
    const { context, page: p } = await page();
    await p.goto(`${base}/research/torah-permanence`);
    await p.getByLabel('Read through a tradition’s lens').selectOption('rabbinic-judaism');
    await expect.poll(() => p.getByRole('status').first().textContent()).toMatch(/lens: Rabbinic Judaism/);
    await expect(p.locator('#explorer .position').filter({ hasText: 'AM-CLAIM-000219' }).first().textContent()).resolves.toMatch(/Supported under selected assumptions/);
    await context.close();
  });
});

describe('brand and emblem introduction', () => {
  it('shows the real logo, a social preview and icons', async () => {
    const html = await (await fetch(`${base}/`)).text();
    expect(html).toMatch(/<img[^>]+src="\/brand\/abrahammoses-logo-ivory\.svg"[^>]+alt="AbrahamMoses"|<img[^>]+alt="AbrahamMoses"[^>]+src="\/brand\/abrahammoses-logo-ivory\.svg"/);
    expect(html).toMatch(new RegExp(`<meta property="og:image" content="${base}/opengraph-image\\.png`));
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image"/>');
    expect(html).toMatch(/<link rel="icon" href="\/icon\.svg/);
    expect(html).toMatch(/<link rel="apple-touch-icon" href="\/apple-icon\.png/);
    expect(html).toMatch(/<link rel="icon" href="\/favicon\.ico"/);
    expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest"/>');
    for (const asset of ['/brand/abrahammoses-logo-ivory.svg', '/brand/abrahammoses-logo.svg', '/brand/abrahammoses-mark.svg', '/icon.svg']) {
      const res = await fetch(`${base}${asset}`);
      expect(res.status, asset).toBe(200);
      expect(res.headers.get('content-type'), asset).toContain('image/svg+xml');
    }
    const manifest = await (await fetch(`${base}/manifest.webmanifest`)).json();
    for (const icon of manifest.icons as Array<{ src: string }>) {
      const res = await fetch(`${base}${icon.src}`);
      expect(res.status, icon.src).toBe(200);
      expect(res.headers.get('content-type'), icon.src).toContain('image/png');
    }
    expect((await fetch(`${base}/favicon.ico`)).status).toBe(200);
  });

  it('works without JavaScript: each ring is a link to its worked answer', async () => {
    const { context, page: p } = await page({ javaScriptEnabled: false });
    await p.goto(`${base}/`);
    const rings = p.locator('a.emblem-node:not(.emblem-node--centre)');
    await expect(rings.count()).resolves.toBe(4);
    const labels = await rings.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
    // Clockwise from the top, in the historical order the cases are listed in.
    expect(labels.map((l) => l?.split(':')[0])).toEqual(['Jewish studies', 'Christian studies', 'Islamic studies', 'Latter-day Saint studies']);
    await rings.nth(2).click();
    await p.waitForURL(/case=ibrahim-heirs-and-revelation/);
    await expect(p.locator('#worked-title').locator('..').textContent()).resolves.toContain('Ibrāhīm');
    await context.close();
  });

  it('traces a question by hover or keyboard, in step with the example questions', async () => {
    const { context, page: p } = await page();
    await p.goto(`${base}/`);
    const caption = p.locator('#emblem-intro-caption');

    await p.hover('a.emblem-node[aria-label^="Christian studies"]');
    await expect.poll(() => caption.textContent()).toContain('What changed concerning priesthood');
    await expect(p.locator('.example[data-case="priesthood-new-covenant"]').getAttribute('class')).resolves.toContain('is-lit');

    await p.mouse.move(0, 0);
    await p.hover('.example[data-case="restoration-priesthood-authority"]');
    await expect.poll(() => p.locator('a.emblem-node[aria-label^="Latter-day Saint"]').getAttribute('class')).toContain('is-active');

    await p.mouse.move(0, 0);
    await p.locator('a.emblem-node--centre').focus();
    await expect.poll(() => caption.textContent()).toContain('The shared record');
    await context.close();
  });

  it('does not animate for visitors who ask for reduced motion', async () => {
    const { context, page: p } = await page({ reducedMotion: 'reduce' });
    await p.goto(`${base}/`);
    const names = await p.evaluate(() =>
      ['.emblem-mark', '.emblem-play-fill', '.emblem-play-sparkle'].map((s) => getComputedStyle(document.querySelector(s)!).animationName),
    );
    expect(names).toEqual(['none', 'none', 'none']);
    await context.close();
  });
});

describe('research workspace', () => {
  it('answers a question without sign-in and keeps saved traces on the device', async () => {
    const { context, page: p } = await page();
    await p.goto(`${base}/research`);
    await p.getByLabel('Research question').fill('Who are the heirs of Ibrahim?');
    await p.getByRole('button', { name: 'Search the record' }).click();
    await p.waitForURL(/q=Who/);
    await expect(p.getByText('This question has a research case')).toBeTruthy();
    await expect(p.locator('main').textContent()).resolves.toContain('Who are the heirs of Ibrāhīm');

    await p.getByRole('button', { name: 'Save this trace' }).click();
    const stored = await p.evaluate(() => window.localStorage.getItem('abrahammoses.traces.v1'));
    expect(JSON.parse(stored!)[0].url).toContain('/research?q=');
    await p.reload();
    await expect(p.locator('#traces-title').locator('..').textContent()).resolves.toContain('Who are the heirs of Ibrahim?');
    await p.getByRole('button', { name: 'Delete all' }).click();
    expect(await p.evaluate(() => window.localStorage.getItem('abrahammoses.traces.v1'))).toBeNull();
    await context.close();
  });
});

describe('accessibility', () => {
  it('has no WCAG 2.2 A/AA violations on the main pages', async () => {
    const { context, page: p } = await page();
    const report: string[] = [];
    for (const path of PAGES) {
      await p.goto(`${base}${path}`);
      const results = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      for (const v of results.violations) {
        report.push(`${path}: ${v.id} (${v.impact}) — ${v.nodes.length} node(s): ${v.nodes[0]?.target.join(' ')}`);
      }
    }
    expect(report).toEqual([]);
    await context.close();
  });
});
