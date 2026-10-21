'use client';
import { useEffect, useRef, useState } from 'react';
import {
  completeEmailLink,
  completeGoogleRedirect,
  firebaseClientAvailable,
  refreshVerification,
  registerWithEmail,
  resendVerification,
  sendPasswordReset,
  signInWithEmail,
  signInWithGoogle,
  signOutUser,
  watchUser,
} from '@/lib/firebase/client';
import { googleFailure, prefersRedirect, type GoogleFailure } from '@/lib/firebase/google';

type User = { email: string | null; emailVerified: boolean };
type Mode = 'sign-in' | 'register' | 'reset';

const WORKSPACE = '/institutional/workspace';
const DEEP_ANALYSIS = '/institutional/workspace/deep-analysis';
const SIGN_IN = '/institutional/workspace/sign-in';
const NEXT_ALLOWED = [WORKSPACE, DEEP_ANALYSIS];

/** Where to go after sign-in: `?next=` when it names one of this site's own pages, else the workspace. */
export function nextTarget(search: string): string {
  const next = new URLSearchParams(search).get('next') ?? '';
  return NEXT_ALLOWED.includes(next) ? next : WORKSPACE;
}

function friendly(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  if (code === 'auth/operation-not-allowed') return 'Email-link sign-in is not enabled for this project yet.';
  if (code === 'auth/unauthorized-continue-uri' || code === 'auth/unauthorized-domain') return 'This address is not an authorised sign-in domain for the project.';
  if (code === 'auth/invalid-action-code' || code === 'auth/expired-action-code') return 'This sign-in link has expired or was already used. Request a new one.';
  if (code === 'auth/invalid-email') return 'That is not a valid email address.';
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found' || code === 'auth/invalid-login-credentials')
    return 'The email address or password is not correct.';
  if (code === 'auth/email-already-in-use') return 'An account with this email address already exists. Sign in, or reset the password.';
  if (code === 'auth/weak-password' || code === 'auth/password-does-not-meet-requirements') return 'Choose a longer password (at least 8 characters).';
  if (code === 'auth/too-many-requests') return 'Too many attempts. Wait a few minutes and try again.';
  if (code === 'auth/missing-password') return 'Enter a password.';
  return 'Sign-in failed. Try again.';
}

/** Google's standard four-colour "G" (branding guidelines: unmodified, on a neutral button). */
function GoogleMark() {
  return (
    <svg className="ws-google__mark" viewBox="0 0 48 48" width="20" height="20" aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function GoogleSignIn() {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<GoogleFailure | null>(null);
  const alertRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (failure && !failure.quiet) alertRef.current?.focus();
  }, [failure]);

  const start = async (mode: 'popup' | 'redirect') => {
    setBusy(true);
    setFailure(null);
    try {
      const standalone = typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches;
      const effective = mode === 'popup' && prefersRedirect(navigator.userAgent, standalone) ? 'redirect' : mode;
      if ((await signInWithGoogle(effective)) === 'done') window.location.assign(nextTarget(window.location.search));
    } catch (e) {
      setFailure(googleFailure(e, window.location.origin));
      setBusy(false);
    }
  };

  return (
    <div className="ws-google">
      <button className="ws-google__button" type="button" onClick={() => start('popup')} disabled={busy} aria-describedby="ws-google-hint">
        <GoogleMark />
        <span>{busy ? 'Opening Google…' : 'Sign in with Google'}</span>
      </button>
      <p className="ws-hint" id="ws-google-hint">Opens a Google window to choose an account.</p>
      {failure ? (
        <div className={`ws-msg${failure.quiet ? '' : ' ws-msg--error'}`} role={failure.quiet ? 'status' : 'alert'} tabIndex={-1} ref={alertRef}>
          <p className="ws-msg__text">{failure.message}</p>
          {failure.offerRedirect ? (
            <button className="button button--quiet" type="button" onClick={() => start('redirect')}>Continue with Google in this window</button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function continueUrl(): string {
  const next = nextTarget(window.location.search);
  return `${window.location.origin}${SIGN_IN}${next === WORKSPACE ? '' : `?next=${encodeURIComponent(next)}`}`;
}

function SignedIn({ user }: { user: User }) {
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const next = typeof window === 'undefined' ? WORKSPACE : nextTarget(window.location.search);
  const run = async (f: () => Promise<void>) => {
    setBusy(true);
    setMsg(null);
    try {
      await f();
    } catch (e) {
      setMsg({ text: friendly(e), error: true });
    }
    setBusy(false);
  };
  return (
    <div className="ws-panel ws-signin ws-signin--formal">
      <p className="ws-msg" role="status">
        Signed in as <strong>{user.email ?? 'an account without an email address'}</strong>.
        {user.emailVerified ? ' Email address verified.' : ' Email address not verified yet.'}
      </p>
      {!user.emailVerified ? (
        <div className="ws-form">
          <p className="ws-hint">
            Open the verification link we sent to your inbox, then select “I have verified”. Deep Analysis with the AI layer needs a verified address;
            rule-based analysis does not.
          </p>
          <div className="ws-row">
            <button
              className="button button--solid"
              type="button"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  if (await refreshVerification()) window.location.assign(next);
                  else setMsg({ text: 'The address is not verified yet. Open the link in the email, then try again.', error: true });
                })
              }
            >
              I have verified
            </button>
            <button className="button button--quiet" type="button" disabled={busy} onClick={() => run(async () => { await resendVerification(continueUrl()); setMsg({ text: `A new verification link was sent to ${user.email}.` }); })}>
              Send the link again
            </button>
          </div>
        </div>
      ) : null}
      <div aria-live="polite">{msg ? <p className={`ws-msg${msg.error ? ' ws-msg--error' : ''}`}>{msg.text}</p> : null}</div>
      <ul className="ws-links">
        <li><a href={DEEP_ANALYSIS}>Open Deep Analysis</a></li>
        <li><a href={WORKSPACE}>Open the evidence workspace</a></li>
        <li><button className="ws-linkbutton" type="button" onClick={() => run(async () => { await signOutUser(); window.location.reload(); })}>Sign out</button></li>
      </ul>
    </div>
  );
}

function EmailPassword() {
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const titles: Record<Mode, string> = { 'sign-in': 'Sign in with email and password', register: 'Create an account', reset: 'Reset your password' };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const addr = email.trim();
      if (mode === 'reset') {
        await sendPasswordReset(addr, continueUrl());
        setMsg({ text: `If an account exists for ${addr}, a password-reset link has been sent to it.` });
      } else if (mode === 'register') {
        if (password.length < 8) throw Object.assign(new Error('weak'), { code: 'auth/weak-password' });
        await registerWithEmail(addr, password, continueUrl());
        setMsg({ text: `Account created. A verification link was sent to ${addr}; open it before using the AI layer.` });
      } else {
        await signInWithEmail(addr, password);
        window.location.assign(nextTarget(window.location.search));
      }
    } catch (e) {
      setMsg({ text: friendly(e), error: true });
    }
    setBusy(false);
  };

  return (
    <form className="ws-form" onSubmit={submit} aria-labelledby="ws-email-title">
      <h2 className="ws-signin__title" id="ws-email-title">{titles[mode]}</h2>
      <label>
        Email address
        <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      {mode !== 'reset' ? (
        <label>
          Password
          <input
            type="password"
            required
            minLength={mode === 'register' ? 8 : undefined}
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby={mode === 'register' ? 'ws-pw-hint' : undefined}
          />
        </label>
      ) : null}
      {mode === 'register' ? <p className="ws-hint" id="ws-pw-hint">At least 8 characters. We send a link to verify the address.</p> : null}
      <div className="ws-row">
        <button className="button button--solid" type="submit" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'register' ? 'Create account' : mode === 'reset' ? 'Send reset link' : 'Sign in'}
        </button>
      </div>
      <div aria-live="polite">{msg ? <p className={`ws-msg${msg.error ? ' ws-msg--error' : ''}`}>{msg.text}</p> : null}</div>
      <p className="ws-hint ws-modes">
        {mode !== 'sign-in' ? <button className="ws-linkbutton" type="button" onClick={() => { setMode('sign-in'); setMsg(null); }}>Sign in to an existing account</button> : null}
        {mode !== 'register' ? <button className="ws-linkbutton" type="button" onClick={() => { setMode('register'); setMsg(null); }}>Create an account</button> : null}
        {mode !== 'reset' ? <button className="ws-linkbutton" type="button" onClick={() => { setMode('reset'); setMsg(null); }}>Forgot your password?</button> : null}
      </p>
    </form>
  );
}

export function SignIn() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const available = firebaseClientAvailable();

  useEffect(() => {
    if (!available) return;
    let off: (() => void) | undefined;
    (async () => {
      try {
        const r = await completeEmailLink(window.location.href, () => window.prompt('Confirm the email address the link was sent to') || null);
        if (r.done) {
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
          window.location.assign(nextTarget(window.location.search));
          return;
        }
      } catch (e) {
        setError(friendly(e));
      }
      try {
        if (await completeGoogleRedirect()) {
          window.location.assign(nextTarget(window.location.search));
          return;
        }
      } catch (e) {
        setError(googleFailure(e, window.location.origin).message);
      }
      off = await watchUser((u) => setUser(u && !u.anonymous ? { email: u.email, emailVerified: u.emailVerified } : null));
    })();
    return () => off?.();
  }, [available]);

  if (!available) return <p className="ws-msg ws-msg--error" role="status">Sign-in is not configured on this deployment.</p>;
  if (user) return <SignedIn user={user} />;

  return (
    <div className="ws-panel ws-signin ws-signin--formal">
      {error ? <p className="ws-msg ws-msg--error" role="alert">{error}</p> : null}
      <GoogleSignIn />
      <p className="ws-or"><span>or</span></p>
      <EmailPassword />
    </div>
  );
}
