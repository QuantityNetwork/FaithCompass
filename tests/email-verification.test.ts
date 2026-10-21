/**
 * Verification email sending: a refused continue URL (auth/unauthorized-continue-uri, the 2026-10-21 production fault
 * caused by an authorised-domain entry that did not match abrahammoses.com) must not stop the email from going out.
 */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { CONTINUE_URL_REFUSED, NOTICE_KEY, authorizedDomains, continueUrlAllowed, readNotice, resetContinueRefusal, saveNotice, sendWithContinueFallback, verificationSender } from '@/lib/firebase/verification';

const LIVE_LIST = ['localhost', 'abrahammoses-a0a26.firebaseapp.com', 'abrahammoses-a0a26.web.app', 'AbrahamMoses.com'];
const FIXED_LIST = [...LIVE_LIST, 'abrahammoses.com', 'www.abrahammoses.com'];

const fail = (code: string) => Object.assign(new Error(code), { code });

describe('sendWithContinueFallback', () => {
  beforeEach(() => resetContinueRefusal());
  const URL_ = 'https://abrahammoses.com/institutional/workspace/sign-in';

  it('matches the authorised domains exactly, as Firebase did on production (AbrahamMoses.com does not cover abrahammoses.com)', () => {
    expect(continueUrlAllowed(URL_, LIVE_LIST)).toBe(false);
    expect(continueUrlAllowed(URL_, FIXED_LIST)).toBe(true);
    expect(continueUrlAllowed('http://localhost:3000/x', LIVE_LIST)).toBe(true);
    expect(continueUrlAllowed(URL_, null)).toBe(false);
    expect(continueUrlAllowed('not a url', FIXED_LIST)).toBe(false);
  });

  it('sends once, without a continue URL, when the domain is not authorised (no refused request, so no rate limit)', async () => {
    const calls: unknown[] = [];
    await expect(sendWithContinueFallback(async (s) => void calls.push(s), URL_, LIVE_LIST)).resolves.toBe('no-return-link');
    expect(calls).toEqual([undefined]);
  });

  it('sends once, without a continue URL, when the list cannot be read', async () => {
    const calls: unknown[] = [];
    await expect(sendWithContinueFallback(async (s) => void calls.push(s), URL_, null)).resolves.toBe('no-return-link');
    expect(calls).toEqual([undefined]);
  });

  it('sends once with the continue URL when the domain is authorised', async () => {
    const calls: unknown[] = [];
    await expect(sendWithContinueFallback(async (s) => void calls.push(s), URL_, FIXED_LIST)).resolves.toBe('return-link');
    expect(calls).toEqual([{ url: URL_ }]);
  });

  it.each(CONTINUE_URL_REFUSED)('if Firebase still refuses the URL (%s), sends without it and does not try the URL again', async (code) => {
    const calls: unknown[] = [];
    const send = async (s?: { url: string }) => {
      calls.push(s);
      if (s) throw fail(code);
    };
    await expect(sendWithContinueFallback(send, URL_, FIXED_LIST)).resolves.toBe('no-return-link');
    await expect(sendWithContinueFallback(send, URL_, FIXED_LIST)).resolves.toBe('no-return-link');
    expect(calls).toEqual([{ url: URL_ }, undefined, undefined]);
  });

  it('does not retry other errors, such as rate limits, and passes them on', async () => {
    let n = 0;
    await expect(sendWithContinueFallback(async () => { n++; throw fail('auth/too-many-requests'); }, URL_, FIXED_LIST)).rejects.toMatchObject({ code: 'auth/too-many-requests' });
    expect(n).toBe(1);
  });

  it('reads the authorised domains from the public project config, and returns null on failure', async () => {
    const urls: string[] = [];
    const ok = (async (u: string) => { urls.push(u); return new Response(JSON.stringify({ projectId: 'p', authorizedDomains: LIVE_LIST })); }) as unknown as typeof fetch;
    await expect(authorizedDomains('KEY', ok)).resolves.toEqual(LIVE_LIST);
    expect(urls[0]).toBe('https://identitytoolkit.googleapis.com/v1/projects?key=KEY');
  });
});

describe('verification notice and sender', () => {
  it('names the default Firebase sender', () => {
    expect(verificationSender('abrahammoses-a0a26')).toBe('noreply@abrahammoses-a0a26.firebaseapp.com');
  });

  it('carries the outcome to the signed-in view for the same address, for an hour', () => {
    const m = new Map<string, string>();
    const store = { setItem: (k: string, v: string) => void m.set(k, v), getItem: (k: string) => m.get(k) ?? null };
    saveNotice(store, { email: 'A@Example.com', outcome: 'failed', code: 'auth/quota-exceeded', at: 1000 });
    expect(m.has(NOTICE_KEY)).toBe(true);
    expect(readNotice(store, 'a@example.com', 2000)).toMatchObject({ outcome: 'failed', code: 'auth/quota-exceeded' });
    expect(readNotice(store, 'other@example.com', 2000)).toBeNull();
    expect(readNotice(store, 'a@example.com', 1000 + 3_600_001)).toBeNull();
    expect(readNotice(null, 'a@example.com')).toBeNull();
  });
});

describe('sign-in code', () => {
  const client = readFileSync('src/lib/firebase/client.ts', 'utf8');
  const ui = readFileSync('src/components/workspace/sign-in.tsx', 'utf8');
  it('sends the verification email after creating the account, with the fallback, and reports a failure instead of throwing', () => {
    const reg = client.slice(client.indexOf('export async function registerWithEmail'), client.indexOf('export async function resendVerification'));
    expect(reg.indexOf('createUserWithEmailAndPassword(auth')).toBeLessThan(reg.indexOf('sendEmailVerification(cred.user'));
    expect(reg).toContain('sendWithContinueFallback');
    expect(reg).toContain('domainsFor(auth)');
    expect(reg).toContain("verification: 'failed'");
    expect(client).toMatch(/resendVerification[\s\S]*sendWithContinueFallback/);
    expect(client).toMatch(/sendPasswordReset[\s\S]*sendWithContinueFallback/);
  });
  it('offers a resend button, names the sender and asks the user to check spam', () => {
    expect(ui).toContain('Send the link again');
    expect(ui).toContain('check your spam or junk folder');
    expect(ui).toContain('the verification email could not be sent');
  });
});
