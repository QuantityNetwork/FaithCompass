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
  '/research?dossier=covenants',
  '/research?dossier=covenants&view=graph',
  '/research?dossier=covenants&view=table',
  '/research?dossier=covenants&inspect=AM-CLAIM-000187',
  '/research?case=torah-permanence&state=externally_reviewed',
  '/research?q=photosynthesis%20chlorophyll',
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
  '/institutional',
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

describe('brand and shell', () => {
  it('shows the real logo, a social preview and icons', async () => {
    const html = await (await fetch(`${base}/`)).text();
    expect(html).toMatch(/<img[^>]+src="\/brand\/intro\/poster-1600\.webp"[^>]+alt="AbrahamMoses"|<img[^>]+alt="AbrahamMoses"[^>]+src="\/brand\/intro\/poster-1600\.webp"/);
    expect(html).toContain('src="/brand/abrahammoses-logo.svg"');
    expect(html).toContain('src="/brand/abrahammoses-logo-ivory.svg"');
    // The home page is prerendered, so its absolute URLs carry the origin configured at build time.
    expect(html).toMatch(/<meta property="og:image" content="https?:\/\/[^"]+\/opengraph-image\.png/);
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
    for (const asset of ['/brand/intro/poster-1600.webp', '/brand/intro/intro-1600.webm', '/brand/intro/intro-800.mp4']) {
      expect((await fetch(`${base}${asset}`)).status, asset).toBe(200);
    }
    const manifest = await (await fetch(`${base}/manifest.webmanifest`)).json();
    for (const icon of manifest.icons as Array<{ src: string }>) {
      const res = await fetch(`${base}${icon.src}`);
      expect(res.status, icon.src).toBe(200);
      expect(res.headers.get('content-type'), icon.src).toContain('image/png');
    }
    expect((await fetch(`${base}/favicon.ico`)).status).toBe(200);
  });

  it('has exactly six primary sections and marks the current one', async () => {
    const { context, page: p } = await page();
    await p.goto(`${base}/claims/AM-CLAIM-000191`);
    const nav = p.getByRole('navigation', { name: 'Primary' });
    await expect(nav.getByRole('link').allTextContents()).resolves.toEqual(['Research', 'Evidence', 'Compare', 'Methodology', 'Developers', 'Institutional']);
    await expect(nav.getByRole('link', { name: 'Evidence' }).getAttribute('aria-current')).resolves.toBe('true');
    await p.goto(`${base}/institutional`);
    await expect(nav.getByRole('link', { name: 'Institutional' }).getAttribute('aria-current')).resolves.toBe('page');
    await context.close();
  });

  it('starts with a skip link to the main content', async () => {
    const { context, page: p } = await page();
    await p.goto(`${base}/`);
    await p.keyboard.press('Tab');
    await expect(p.evaluate(() => document.activeElement?.textContent)).resolves.toBe('Skip to content');
    await p.keyboard.press('Enter');
    await expect(p.evaluate(() => location.hash)).resolves.toBe('#main');
    await context.close();
  });

  it('works without JavaScript: coverage cards link to the real cases and the question bar submits to research', async () => {
    const { context, page: p } = await page({ javaScriptEnabled: false });
    await p.goto(`${base}/`);
    const cards = p.locator('section[aria-labelledby="coverage-title"] a');
    await expect(cards.evaluateAll((els) => els.map((e) => e.getAttribute('href')))).resolves.toEqual([
      '/research/torah-permanence',
      '/research/priesthood-new-covenant',
      '/research/ibrahim-heirs-and-revelation',
      '/research/restoration-priesthood-authority',
    ]);
    await p.getByLabel('Research question').fill('Who are the heirs of Ibrahim?');
    await p.getByRole('button', { name: 'Research', exact: true }).click();
    // POSTed: the question text never becomes part of an address
    await p.waitForURL(/\/research\?case=ibrahim-heirs-and-revelation$/);
    await context.close();
  });

  it('opens the command palette with Ctrl-K, finds a claim in the record and returns focus on Escape', async () => {
    const { context, page: p, errors } = await page();
    await p.goto(`${base}/methodology`, { waitUntil: 'networkidle' });
    const button = p.getByRole('button', { name: /Search the record/ });
    await button.click();
    const dialog = p.getByRole('dialog', { name: 'Search the record' });
    await dialog.waitFor();
    await p.keyboard.press('Escape');
    await expect(dialog.count()).resolves.toBe(0);
    await expect(button.evaluate((el) => el === document.activeElement)).resolves.toBe(true);

    await p.keyboard.press('Control+k');
    await dialog.waitFor();
    await p.keyboard.type('melchizedekian priesthood');
    const option = dialog.getByRole('option', { name: /Melchizedekian priesthood of Christ supersedes/ });
    await option.waitFor();
    await p.keyboard.press('ArrowDown');
    await expect(p.getByRole('combobox').getAttribute('aria-activedescendant')).resolves.toBe('am-pal-opt-1');
    await option.click();
    await p.waitForURL(/\/claims\/AM-CLAIM-000191/);
    expect(errors).toEqual([]);
    await context.close();
  });

  it('defaults to navy and remembers the ivory reading mode across visits', async () => {
    const { context, page: p } = await page();
    await p.goto(`${base}/`);
    await expect(p.evaluate(() => document.documentElement.getAttribute('data-theme'))).resolves.toBeNull();
    // navy is the default surface, as on production
    await expect(p.evaluate(() => getComputedStyle(document.body).backgroundColor)).resolves.toBe('rgb(11, 16, 32)');
    await p.getByRole('button', { name: 'Ivory reading mode' }).click();
    await expect(p.evaluate(() => document.documentElement.getAttribute('data-theme'))).resolves.toBe('light');
    await p.goto(`${base}/claims`);
    await expect(p.evaluate(() => document.documentElement.getAttribute('data-theme'))).resolves.toBe('light');
    await expect(p.getByRole('button', { name: 'Ivory reading mode' }).getAttribute('aria-pressed')).resolves.toBe('true');
    const bg = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe('rgb(246, 242, 233)');
    await context.close();
  });

  it('plays the intro once per visit, and never on its own for reduced motion', async () => {
    const first = await page();
    await first.page.goto(`${base}/`);
    await expect.poll(() => first.page.locator('.am-stage video').count()).toBe(1);
    await first.page.reload();
    await first.page.getByRole('button', { name: 'Play intro' }).waitFor();
    await expect(first.page.locator('.am-stage video').count()).resolves.toBe(0);
    await first.context.close();

    const reduced = await page({ reducedMotion: 'reduce' });
    await reduced.page.goto(`${base}/`);
    await reduced.page.getByRole('button', { name: 'Play intro' }).waitFor();
    await expect(reduced.page.locator('.am-stage video').count()).resolves.toBe(0);
    await reduced.context.close();
  });

  it('opens and closes the menu at phone width', async () => {
    const { context, page: p } = await page({ viewport: { width: 390, height: 844 } });
    await p.goto(`${base}/`);
    const menu = p.getByRole('button', { name: 'Menu' });
    const nav = p.getByRole('navigation', { name: 'Primary' });
    await expect(nav.isVisible()).resolves.toBe(false);
    await menu.click();
    await expect(menu.getAttribute('aria-expanded')).resolves.toBe('true');
    await expect(nav.isVisible()).resolves.toBe(true);
    await nav.getByRole('link', { name: 'Compare' }).click();
    await p.waitForURL(/\/compare$/);
    await expect.poll(() => menu.getAttribute('aria-expanded')).toBe('false');
    await context.close();
  });
});

describe('research workspace', () => {
  it('posts a question, opens the matching dossier at a clean address and keeps saved traces on the device', async () => {
    const { context, page: p, errors } = await page();
    const posted: string[] = [];
    p.on('request', (r) => {
      if (r.url().includes('/research/ask')) posted.push(`${r.method()} ${r.url()}`);
    });
    await p.goto(`${base}/research`);
    await p.getByLabel('Research question').fill('Who are the heirs of Ibrahim?');
    await p.getByRole('button', { name: 'Research', exact: true }).click();
    await p.waitForURL(/\/research\?case=ibrahim-heirs-and-revelation$/);
    expect(posted[0]).toMatch(/^POST .*\/research\/ask$/);
    expect(p.url()).not.toMatch(/Who|%3F|\?q=/);
    for (const col of ['Direct evidence', 'Interpretations', 'Inferences', 'Unresolved questions']) {
      await expect(p.getByRole('heading', { name: new RegExp(`^${col}`) }).count()).resolves.toBe(1);
    }
    await expect(p.locator('.rw-cov').textContent()).resolves.toContain('Full coverage');

    await p.getByRole('button', { name: 'Save this trace' }).click();
    const stored = await p.evaluate(() => window.localStorage.getItem('abrahammoses.traces.v1'));
    expect(JSON.parse(stored!)[0].url).toContain('/research?case=ibrahim-heirs-and-revelation');
    await p.reload();
    await p.getByRole('button', { name: 'Delete all' }).click();
    expect(await p.evaluate(() => window.localStorage.getItem('abrahammoses.traces.v1'))).toBeNull();
    expect(errors).toEqual([]);
    await context.close();
  });

  it('keeps only the search terms of a free-text question in the address', async () => {
    const res = await fetch(`${base}/research/ask`, {
      method: 'POST',
      body: new URLSearchParams({ q: 'What does my grandmother think about the temple in Jerusalem?' }),
      redirect: 'manual',
    });
    expect(res.status).toBe(303);
    const loc = res.headers.get('location')!;
    expect(loc).toContain('/research?q=');
    expect(decodeURIComponent(loc)).not.toContain('grandmother think');
    const vision = await fetch(`${base}/research/ask`, {
      method: 'POST',
      body: new URLSearchParams({ q: 'How is the Abrahamic covenant related to the Mosaic covenant at Sinai?' }),
      redirect: 'manual',
    });
    expect(vision.headers.get('location')).toMatch(/\/research\?dossier=covenants$/);
  });

  it('shows partial coverage, computed gaps and the four-way split for the covenant dossier', async () => {
    const { context, page: p } = await page();
    await p.goto(`${base}/research?dossier=covenants`);
    await expect(p.locator('.rw-cov').textContent()).resolves.toContain('Partial coverage');
    const unresolved = p.locator('.rw-col--unresolved');
    await expect(unresolved.textContent()).resolves.toContain('Coverage gap · computed from the record');
    await expect(unresolved.textContent()).resolves.toContain('No published research case addresses this question as asked');
    await expect(p.locator('.rw-col--direct .rw-item').count()).resolves.toBeGreaterThan(0);
    await context.close();
  });

  it('makes no-answer a first-class state, without generated text', async () => {
    const { context, page: p } = await page();
    await p.goto(`${base}/research?q=photosynthesis%20chlorophyll`);
    await expect(p.getByRole('heading', { level: 1 }).textContent()).resolves.toBe('The record does not yet answer this question.');
    await expect(p.locator('main').textContent()).resolves.toContain('nothing is generated to fill the gap');
    await expect(p.locator('.rw-empty').count()).resolves.toBe(4);
    await context.close();
  });

  it('filters by review state and says when a column is empty because of a filter', async () => {
    const { context, page: p } = await page();
    await p.goto(`${base}/research?dossier=covenants`);
    await p.getByLabel('Review state').selectOption('externally_reviewed');
    await p.waitForURL(/state=externally_reviewed/);
    await expect(p.locator('main').textContent()).resolves.toContain('No record in this column matches the filters.');
    await expect(p.locator('.rw-filters').textContent()).resolves.toContain('Showing 0 of');
    await context.close();
  });

  it('opens the nine-part inspector as a dialog, closes on Escape and returns focus', async () => {
    const { context, page: p, errors } = await page();
    await p.goto(`${base}/research?dossier=covenants`, { waitUntil: 'networkidle' });
    const trigger = p.locator('.rw-col--direct [data-inspect-trigger]').first();
    const code = await trigger.getAttribute('data-inspect-trigger');
    await trigger.click();
    const dialog = p.getByRole('dialog');
    await dialog.waitFor();
    await p.waitForURL(new RegExp(`inspect=${code}`));
    await expect(dialog.getAttribute('aria-modal')).resolves.toBe('true');
    const parts = await dialog.locator('.ins-part__title').allTextContents();
    expect(parts.map((t) => t.replace(/^\d\s*/, '').trim())).toEqual([
      'Exact claim',
      'Cited passage',
      'Source edition',
      'Original-language text',
      'Translation differences',
      'Supporting and opposing arguments',
      'Assumptions',
      'Review history',
      'Known limitations',
    ]);
    await expect(dialog.textContent()).resolves.toContain('Permanent citation');
    await expect(p.evaluate(() => document.activeElement?.id)).resolves.toBe('ins-dlg-title');
    await p.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });
    await p.waitForURL((u) => !u.searchParams.has('inspect'));
    await expect.poll(() => p.evaluate(() => document.activeElement?.getAttribute('data-inspect-trigger'))).toBe(code);
    expect(errors).toEqual([]);
    await context.close();
  });

  it('serves the inspector without JavaScript from its address', async () => {
    const { context, page: p } = await page({ javaScriptEnabled: false });
    await p.goto(`${base}/research?dossier=covenants&inspect=AM-CLAIM-000187`);
    await expect(p.getByRole('dialog').locator('.ins-statement').textContent()).resolves.toContain('Genesis presents an unconditional promise');
    await p.getByRole('link', { name: /Close the inspector/ }).click();
    await p.waitForURL(/\/research\?dossier=covenants$/);
    await context.close();
  });

  it('draws the argument graph with a table alternative', async () => {
    const { context, page: p } = await page();
    await p.goto(`${base}/research?dossier=covenants&view=graph`);
    await expect(p.locator('.rw-graph svg').getAttribute('aria-label')).resolves.toMatch(/Argument graph: \d+ premises and assumptions, \d+ derivations/);
    await p.getByRole('link', { name: 'Same content as a table' }).click();
    await p.waitForURL(/view=table/);
    await expect(p.locator('table.table tbody tr').count()).resolves.toBeGreaterThan(10);
    await context.close();
  });

  it('replays the pipeline without calling anything', async () => {
    const { context, page: p } = await page();
    await p.goto(`${base}/research?dossier=covenants`, { waitUntil: 'networkidle' });
    await expect(p.locator('.rw-pipe__note').textContent()).resolves.toContain('No model is called');
    const requests: string[] = [];
    p.on('request', (r) => requests.push(r.url()));
    await p.getByRole('button', { name: 'Replay the steps' }).click();
    await expect.poll(() => p.locator('.rw-pipe__step.is-done').count(), { timeout: 6000 }).toBe(7);
    expect(requests).toEqual([]);
    await context.close();
  });

  it('exports the dossier as JSON and Markdown with a reproducibility manifest', async () => {
    const json = await fetch(`${base}/research/export?dossier=covenants&format=json`);
    expect(json.headers.get('content-disposition')).toMatch(/attachment; filename="abrahammoses-covenants-.+\.json"/);
    const body = await json.json();
    expect(body.manifest.record_version).toBeTruthy();
    expect(body.manifest.claims[0]).toMatch(/^AM-CLAIM-\d+@rev\d+$/);
    expect(body.review.named_reviewers).toEqual([]);
    const md = await (await fetch(`${base}/research/export?dossier=covenants&format=md`)).text();
    expect(md).toContain('## Unresolved questions');
    expect(md).toContain('## Reproducibility manifest');
  });
});

describe('accessibility', () => {
  async function scan(p: Page, label: string, report: string[]) {
    const results = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    for (const v of results.violations) {
      report.push(`${label}: ${v.id} (${v.impact}) — ${v.nodes.length} node(s): ${v.nodes[0]?.target.join(' ')}`);
    }
  }

  for (const theme of ['light', 'dark'] as const) {
    it(`has no WCAG 2.2 A/AA violations on the main pages (${theme})`, async () => {
      const { context, page: p } = await page({ reducedMotion: 'reduce' });
      if (theme === 'light') await context.addInitScript(() => localStorage.setItem('am-reading-mode', 'light'));
      const report: string[] = [];
      for (const path of PAGES) {
        await p.goto(`${base}${path}`);
        await scan(p, path, report);
      }
      expect(report).toEqual([]);
      await context.close();
    });
  }

  it('has no violations with the command palette open', async () => {
    const { context, page: p } = await page({ reducedMotion: 'reduce' });
    const report: string[] = [];
    await p.goto(`${base}/`, { waitUntil: 'networkidle' });
    await p.keyboard.press('Control+k');
    await p.getByRole('dialog').waitFor();
    await p.keyboard.type('covenant');
    await p.getByRole('option').first().waitFor();
    await scan(p, 'palette', report);
    expect(report).toEqual([]);
    await context.close();
  });
});
