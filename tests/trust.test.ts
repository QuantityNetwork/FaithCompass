/**
 * The Trust pack and the Deep Analysis profile: the published security facts must stay true of the code, the
 * downloadable DPA must match its source, every third-party host in the code must be a listed sub-processor (or
 * listed as not one), and no page may claim a certification, audit or test that does not exist.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import nextConfig from '../next.config.mjs';
import { openAiRequest } from '@/lib/deep-analysis/ai';
import { CONSENT_VERSION, ORG_MAX, ROLES, ROLE_IDS, checkProfile } from '@/lib/leads/profile';
import { NAV_SECTIONS, FOOTER_NAV } from '@/lib/site/nav';
import { PRIVACY_VERSION } from '@/lib/site/privacy-version';
import { DPA_FILES, DPA_PARTIES, DPA_STATUS, dpaDigest, dpaDocument } from '@/lib/trust/dpa';
import { FIRESTORE, GAPS, HOSTING, SECURITY_HEADERS } from '@/lib/trust/facts';
import { QUESTIONNAIRE } from '@/lib/trust/questionnaire';
import { NON_PROCESSOR_HOSTS, NOT_SUBPROCESSORS, SUBPROCESSORS } from '@/lib/trust/subprocessors';

const ROOT = join(__dirname, '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
function files(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(join(ROOT, dir))) {
    const p = join(dir, e);
    if (statSync(join(ROOT, p)).isDirectory()) files(p, out);
    else if (/\.(ts|tsx|mjs)$/.test(e)) out.push(p);
  }
  return out;
}

describe('security facts match the code', () => {
  it('lists exactly the headers next.config.mjs sets on every page, including HSTS for two years', async () => {
    const all = await nextConfig.headers!();
    const site = all.find((h) => h.source === '/:path*')!;
    const keys = site.headers.map((h) => h.key);
    for (const [h] of SECURITY_HEADERS) expect(keys, h).toContain(h);
    expect(site.headers.find((h) => h.key === 'Strict-Transport-Security')?.value).toBe('max-age=63072000');
    expect(site.headers.find((h) => h.key === 'X-Frame-Options')?.value).toBe('SAMEORIGIN');
  });

  it('sends AI requests with provider-side storage turned off', () => {
    for (const model of ['gpt-5.6-terra', 'gpt-4.1-mini']) expect((openAiRequest(model, 'x', 'medium').body as { store?: boolean }).store).toBe(false);
  });

  it('enforces the two-person rule and private profiles in firestore.rules', () => {
    const rules = read('firestore.rules');
    expect(rules).toContain('resource.data.proposedBy != uid()');
    expect(rules).toContain('resource.data.createdBy != uid()');
    expect(rules).toMatch(/match \/user_profiles\/\{u\} \{[\s\S]*?allow list: if false;/);
    // The rules' role list and length limit are the ones the form uses.
    expect(rules).toContain(`d.role in [${ROLE_IDS.map((r) => `'${r}'`).join(', ')}]`);
    expect(rules).toContain(`d.organisation.size() <= ${ORG_MAX}`);
    expect(rules).toContain(`d.source == 'deep-analysis'`);
  });

  it('holds no service-account or admin credential in the server code', () => {
    for (const f of files('src')) expect(read(f), f).not.toMatch(/firebase-admin|GOOGLE_APPLICATION_CREDENTIALS|private_key_id|SUPABASE_SERVICE_ROLE_KEY\s*=/);
  });

  it('states the functions region that vercel.json pins, in the EU', () => {
    const cfg = JSON.parse(readFileSync('vercel.json', 'utf8'));
    expect(cfg.regions).toEqual([HOSTING.functionsRegion]);
    expect(HOSTING.functionsRegion).toBe('arn1');
    expect(HOSTING.functionsRegionName).toBe('Stockholm, Sweden (EU)');
    expect(GAPS.map((g) => g.control).join(' ')).not.toMatch(/EU-only/);
  });

  it('uses final DPA values, with brackets only for what the customer fills in', () => {
    const text = JSON.stringify(dpaDocument());
    expect(text).not.toMatch(/\[(30|48)\]/);
    for (const v of ['at least 30 days’ written notice before adding', 'within 48 hours', 'within 30 days', 'no more than once a year']) expect(text).toContain(v);
    expect(JSON.stringify(QUESTIONNAIRE)).not.toMatch(/\[(30|48)\]/);
  });

  it('names the real Firestore location', () => {
    expect(FIRESTORE.location).toBe('eur3');
    expect(FIRESTORE.project).toBe('abrahammoses-a0a26');
  });
});

describe('sub-processors', () => {
  it('cover every third-party host the code calls', () => {
    const known = new Set([...SUBPROCESSORS.flatMap((s) => s.hosts), ...NOT_SUBPROCESSORS.flatMap((n) => n.hosts), ...NON_PROCESSOR_HOSTS]);
    const found = new Set<string>();
    // The Trust pages link to the providers' own documentation; those links are not calls.
    for (const f of [...files('src').filter((f) => !/src\/(lib|app\/institutional)\/trust\//.test(f)), 'next.config.mjs']) {
      for (const m of read(f).matchAll(/https:\/\/([a-z0-9.-]+\.[a-z]{2,})/g)) found.add(m[1]);
    }
    const ownOrDocs = (h: string) => /(^|\.)abrahammoses\.com$|^localhost/.test(h);
    const unknown = [...found].filter((h) => !known.has(h) && !ownOrDocs(h) && ![...known].some((k) => h.endsWith(`.${k}`)));
    expect(unknown).toEqual([]);
  });

  it('include Vercel, Google Firebase, OpenAI and Stripe, each with purpose, data, location and its own terms', () => {
    expect(SUBPROCESSORS.map((s) => s.id)).toEqual(['vercel', 'firebase', 'openai', 'stripe']);
    for (const s of SUBPROCESSORS) {
      for (const k of ['purpose', 'data', 'location', 'safeguard'] as const) expect(s[k].length, `${s.id}.${k}`).toBeGreaterThan(10);
      expect(s.links.length).toBeGreaterThan(0);
      for (const l of s.links) expect(l.href).toMatch(/^https:\/\//);
    }
  });
});

describe('Data Processing Agreement template', () => {
  it('is marked as a template subject to legal review and signature', () => {
    expect(DPA_STATUS).toBe('Template, subject to legal review and signature');
  });

  it('has the customer as controller and Sagolik as processor, with no invented registration or VAT number', () => {
    const [controller, processor] = DPA_PARTIES;
    expect(controller[0]).toBe('Controller');
    expect(controller[1]).toContain('[registration number]');
    expect(processor[1]).toMatch(/^Sagolik, Halmstad, Sweden/);
    expect(processor[1]).not.toMatch(/\d{6}-\d{4}|SE\d{10}01|org\.? ?nr|organisation number/i);
  });

  it('covers every element of Article 28(3) GDPR', () => {
    const refs = dpaDocument().clauses.map((c) => c.ref ?? '').join(' ');
    for (const letter of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) expect(refs).toContain(`28(3)(${letter})`);
  });

  it('ships downloads built from the current text (run `npx tsx scripts/trust/build-dpa.ts` after editing)', () => {
    const manifest = JSON.parse(read('public/trust/dpa-manifest.json'));
    expect(manifest.contentSha256).toBe(dpaDigest());
    for (const kind of ['docx', 'pdf'] as const) {
      const p = join(ROOT, 'public', DPA_FILES[kind]);
      expect(existsSync(p), p).toBe(true);
      expect(createHash('sha256').update(readFileSync(p)).digest('hex')).toBe(manifest.files[kind].sha256);
    }
  });
});

describe('honesty of the Trust pack', () => {
  const text = [read('src/lib/trust/facts.ts'), read('src/lib/trust/dpa.ts'), read('src/lib/trust/questionnaire.ts'), read('src/lib/trust/subprocessors.ts'), ...files('src/app/institutional/trust').map(read)].join('\n');

  it('claims no certification, audit, penetration test, customer or bank validation', () => {
    expect(text).not.toMatch(/\b(AbrahamMoses|Sagolik|the service|the operator|we) (is|are|has been|have been) (certified|audited|penetration[- ]tested|validated)\b/i);
    expect(text).not.toMatch(/\b(used|trusted|validated|deployed) by (banks|insurers|leading)/i);
    expect(text).not.toMatch(/SOC 2 (compliant|certified)|ISO(\/IEC)? ?27001[- ]certified|GDPR[- ]certified/i);
    for (const control of ['ISO/IEC 27001 certification', 'SOC 2 report', 'External penetration test']) {
      expect(GAPS.find((g) => g.control === control)?.status, control).toBe('not in place');
    }
    const answers = QUESTIONNAIRE.flatMap((g) => g.items);
    expect(answers.find((a) => a.id === 'certification')?.short).toBe('No');
    expect(answers.find((a) => a.id === 'pentest')?.short).toBe('No external test');
  });

  it('never shows the owner’s personal name', () => {
    expect(text).not.toMatch(/Mikael|Andersson|private individual/);
    expect(JSON.stringify(dpaDocument())).not.toMatch(/Mikael|Andersson|Markus/);
  });

  it('is linked from the Institutional section and the footer', () => {
    const inst = NAV_SECTIONS.find((s) => s.href === '/institutional')!;
    expect(inst.pages.map((p) => p.href)).toContain('/institutional/trust');
    expect(FOOTER_NAV.flatMap((g) => g.links).map((l) => l.href)).toContain('/institutional/trust');
  });
});

describe('Deep Analysis profile', () => {
  it('offers the five roles, in order', () => {
    expect(ROLES.map((r) => r.label)).toEqual(['Credit / Risk', 'Model risk / AI governance', 'Compliance', 'Legal / General Counsel', 'Other']);
  });

  it('normalises and validates the input; pilot interest is off unless ticked', () => {
    const ok = checkProfile({ organisation: '  Example   Sparbank ', role: 'compliance', pilotInterest: false }, 'a@b.example', PRIVACY_VERSION);
    expect(ok).toEqual({ ok: true, fields: { organisation: 'Example Sparbank', role: 'compliance', pilotInterest: false, consentVersion: CONSENT_VERSION, privacyVersion: '1.3', email: 'a@b.example', source: 'deep-analysis' } });
    expect(checkProfile({ organisation: ' ', role: 'compliance', pilotInterest: false }, null, '1.3')).toMatchObject({ ok: false, field: 'organisation' });
    expect(checkProfile({ organisation: 'x'.repeat(ORG_MAX + 1), role: 'compliance', pilotInterest: false }, null, '1.3')).toMatchObject({ ok: false, field: 'organisation' });
    expect(checkProfile({ organisation: 'Bank', role: '', pilotInterest: true }, null, '1.3')).toMatchObject({ ok: false, field: 'role' });
    expect(checkProfile({ organisation: 'Bank', role: 'ceo' as never, pilotInterest: false }, null, '1.3')).toMatchObject({ ok: false, field: 'role' });
  });

  it('is described in the privacy policy, whose version was bumped', () => {
    expect(PRIVACY_VERSION).toBe('1.3');
    const privacy = read('src/app/privacy/page.tsx');
    expect(privacy).toContain('id="profile"');
    expect(privacy).toContain('Article 6(1)(a)');
  });

  it('renders the pilot checkbox unticked by default', () => {
    const src = read('src/components/deep-analysis/lead-capture.tsx');
    expect(src).toContain("useState<ProfileInput>({ organisation: '', role: '', pilotInterest: false })");
  });
});
