/**
 * Verification email sending: a refused continue URL (auth/unauthorized-continue-uri, the 2026-10-21 production fault
 * caused by an authorised-domain entry that did not match abrahammoses.com) must not stop the email from going out.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTINUE_URL_REFUSED, NOTICE_KEY, readNotice, saveNotice, sendWithContinueFallback, verificationSender } from '@/lib/firebase/verification';

const fail = (code: string) => Object.assign(new Error(code), { code });

describe('sendWithContinueFallback', () => {
  it('sends once with the continue URL when Firebase accepts it', async () => {
    const calls: unknown[] = [];
    await expect(sendWithContinueFallback(async (s) => void calls.push(s), 'https://abrahammoses.com/x')).resolves.toBe('return-link');
    expect(calls).toEqual([{ url: 'https://abrahammoses.com/x' }]);
  });

  it.each(CONTINUE_URL_REFUSED)('sends again without a continue URL when Firebase refuses it (%s)', async (code) => {
    const calls: unknown[] = [];
    const send = async (s?: { url: string }) => {
      calls.push(s);
      if (s) throw fail(code);
    };
    await expect(sendWithContinueFallback(send, 'https://abrahammoses.com/x')).resolves.toBe('no-return-link');
    expect(calls).toEqual([{ url: 'https://abrahammoses.com/x' }, undefined]);
  });

  it('does not retry other errors, such as rate limits, and passes them on', async () => {
    let n = 0;
    await expect(sendWithContinueFallback(async () => { n++; throw fail('auth/too-many-requests'); }, 'https://abrahammoses.com/x')).rejects.toMatchObject({ code: 'auth/too-many-requests' });
    expect(n).toBe(1);
  });

  it('passes on a failure of the fallback send', async () => {
    await expect(sendWithContinueFallback(async (s) => { throw fail(s ? 'auth/unauthorized-continue-uri' : 'auth/quota-exceeded'); }, 'u')).rejects.toMatchObject({ code: 'auth/quota-exceeded' });
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
