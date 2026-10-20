/** Release hardening: honest provider reporting, safe error logs, security headers. */
import { describe, expect, it } from 'vitest';
import nextConfig from '../next.config.mjs';
import { DEFAULT_DEEP_MODEL, DEFAULT_FAST_MODEL } from '@/lib/evidence/providers/anthropic';
import { providerStatus } from '@/lib/evidence/providers/registry';
import { logServerError, setErrorSink } from '@/lib/security/audit-log';

describe('reasoning provider status', () => {
  it('reports the curated provider as configured, not degraded', () => {
    expect(providerStatus({})).toMatchObject({ configured: 'corpus', active: 'corpus', degraded: false });
  });
  it('reports a configured provider without credentials as degraded, never silently', () => {
    const s = providerStatus({ EVIDENCE_PROVIDER: 'anthropic' });
    expect(s).toMatchObject({ configured: 'anthropic', active: 'corpus', degraded: true });
    expect(s.reason).toMatch(/no API key/);
  });
  it('reports an unsupported provider name as degraded', () => {
    expect(providerStatus({ EVIDENCE_PROVIDER: 'other' })).toMatchObject({ active: 'corpus', degraded: true });
  });
  it('reports an available provider as active', () => {
    const s = providerStatus({ EVIDENCE_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'test-not-a-key' });
    expect(s).toMatchObject({ active: 'anthropic', degraded: false });
  });
  it('defaults to current model IDs, not legacy ones', () => {
    for (const id of [DEFAULT_FAST_MODEL, DEFAULT_DEEP_MODEL]) {
      expect(id).toMatch(/^claude-[a-z]+-\d+-\d+$/);
      expect(id).not.toMatch(/4-5|20251001|^claude-opus-5$/);
    }
  });
});

describe('server error logs', () => {
  it('never include the error message, which can carry request text', () => {
    const lines: string[] = [];
    setErrorSink((l) => lines.push(l));
    logServerError('test', new Error('user asked: my private question'));
    setErrorSink(null);
    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain('private question');
    expect(JSON.parse(lines[0])).toMatchObject({ type: 'error', scope: 'test', name: 'Error' });
  });
});

describe('security headers', () => {
  it('sends CSP, HSTS and no fingerprint header', async () => {
    expect(nextConfig.poweredByHeader).toBe(false);
    const rules = await nextConfig.headers!();
    const h = Object.fromEntries(rules[0].headers.map((x: { key: string; value: string }) => [x.key, x.value]));
    expect(h['Strict-Transport-Security']).toMatch(/max-age=\d{8}/);
    const csp = h['Content-Security-Policy'];
    for (const d of ["default-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'self'"]) {
      expect(csp).toContain(d);
    }
    expect(h['Permissions-Policy']).not.toContain('interest-cohort');
  });
});
