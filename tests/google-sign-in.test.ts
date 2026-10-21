import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { googleFailure, prefersRedirect, REDIRECT_CODES } from '@/lib/firebase/google';

const err = (code: string) => Object.assign(new Error(code), { code });

describe('Google sign-in: failures', () => {
  it('explains a blocked pop-up and offers the same-window redirect', () => {
    const f = googleFailure(err('auth/popup-blocked'), 'https://abrahammoses.com');
    expect(f.offerRedirect).toBe(true);
    expect(f.quiet).toBeFalsy();
    expect(f.message).toMatch(/blocked the Google sign-in window/);
  });

  it('names the host when the domain is not authorised, without offering a redirect that would fail too', () => {
    const f = googleFailure(err('auth/unauthorized-domain'), 'https://preview.example.app');
    expect(f.message).toContain('preview.example.app');
    expect(f.message).toMatch(/Authorised domains/);
    expect(f.offerRedirect).toBe(false);
  });

  it('treats a closed or cancelled pop-up as a quiet status, not an error', () => {
    for (const c of ['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled']) expect(googleFailure(err(c)).quiet).toBe(true);
  });

  it('has a generic message for unknown errors and never echoes the raw error', () => {
    const f = googleFailure(new Error('secret internal detail'));
    expect(f.message).not.toContain('secret');
    expect(f.offerRedirect).toBe(false);
  });

  it('redirects automatically only where pop-ups cannot work', () => {
    expect(REDIRECT_CODES.has('auth/operation-not-supported-in-this-environment')).toBe(true);
    expect(REDIRECT_CODES.has('auth/popup-blocked')).toBe(false);
  });
});

describe('Google sign-in: pop-up or redirect', () => {
  it('uses the pop-up in ordinary desktop and mobile browsers, including Safari', () => {
    for (const ua of [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36',
    ])
      expect(prefersRedirect(ua)).toBe(false);
  });

  it('redirects in in-app browsers, Android WebViews and home-screen apps', () => {
    expect(prefersRedirect('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0')).toBe(true);
    expect(prefersRedirect('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/450.0]')).toBe(true);
    expect(prefersRedirect('Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0 Mobile Safari/537.36')).toBe(true);
    expect(prefersRedirect('anything', true)).toBe(true);
  });
});

describe('Google sign-in: headers', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('allows gapi and the auth-domain frame on the workspace pages only, and keeps every other page locked', async () => {
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'proj-x');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', 'proj-x.firebaseapp.com');
    vi.resetModules();
    const { default: cfg } = await import('../next.config.mjs');
    const rules = await cfg.headers!();
    const get = (source: string, key: string) => rules.find((r) => r.source === source)!.headers.find((h) => h.key === key)?.value ?? '';
    const site = get('/:path*', 'Content-Security-Policy');
    expect(site).not.toContain('apis.google.com');
    expect(site).toContain("frame-src 'self';");
    expect(get('/:path*', 'Cross-Origin-Opener-Policy')).toBe('same-origin');
    for (const p of ['/institutional/workspace', '/institutional/workspace/:path*']) {
      const csp = get(p, 'Content-Security-Policy');
      expect(csp).toContain('https://apis.google.com');
      expect(csp).toContain("frame-src 'self' https://proj-x.firebaseapp.com");
      for (const d of ["default-src 'self'", "object-src 'none'", "form-action 'self'", "frame-ancestors 'self'"]) expect(csp).toContain(d);
      expect(get(p, 'Cross-Origin-Opener-Policy')).toBe('same-origin-allow-popups');
    }
    // Header rules apply in order and the later rule wins, so the workspace rules must follow the site-wide one.
    expect(rules.findIndex((r) => r.source === '/institutional/workspace')).toBeGreaterThan(rules.findIndex((r) => r.source === '/:path*'));
  });

  it('ignores an auth domain that is not a plain hostname', async () => {
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'proj-x');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', "evil.com; script-src *");
    vi.resetModules();
    const { default: cfg } = await import('../next.config.mjs');
    const rules = await cfg.headers!();
    const csp = rules.find((r) => r.source === '/institutional/workspace/:path*')!.headers.find((h) => h.key === 'Content-Security-Policy')!.value;
    expect(csp).not.toContain('evil.com');
    expect(csp).not.toContain('apis.google.com');
  });
});

describe('Google sign-in: page', () => {
  const signIn = readFileSync('src/components/workspace/sign-in.tsx', 'utf8');
  const app = readFileSync('src/components/workspace/workspace-app.tsx', 'utf8');

  it('offers Google next to email and password (sign-in, registration with verification, reset), with the unmodified four-colour G hidden from assistive technology', () => {
    expect(signIn).toContain('Sign in with Google');
    expect(signIn).toContain('Create account');
    expect(signIn).toContain('registerWithEmail(');
    expect(signIn).toContain('sendPasswordReset(');
    expect(signIn).toContain('Forgot your password?');
    for (const c of ['#EA4335', '#4285F4', '#FBBC05', '#34A853']) expect(signIn).toContain(c);
    expect(signIn).toMatch(/<svg[^>]*aria-hidden="true"/);
  });

  it('returns only to this site\'s own pages after sign-in', async () => {
    const { nextTarget } = await import('@/components/workspace/sign-in');
    expect(nextTarget('?next=/institutional/workspace/deep-analysis')).toBe('/institutional/workspace/deep-analysis');
    expect(nextTarget('?next=https://evil.example/x')).toBe('/institutional/workspace');
    expect(nextTarget('?next=//evil.example')).toBe('/institutional/workspace');
    expect(nextTarget('')).toBe('/institutional/workspace');
  });

  it('announces failures in a focusable alert', () => {
    expect(signIn).toContain("role={failure.quiet ? 'status' : 'alert'}");
    expect(signIn).toContain('Continue with Google in this window');
  });

  it('shows signed-in users without a role their address and that access is not yet granted', () => {
    expect(app).toContain('Your account has no workspace access yet');
    expect(app).toMatch(/You are signed in as <strong[^>]*>\{user\.email/);
  });
});
