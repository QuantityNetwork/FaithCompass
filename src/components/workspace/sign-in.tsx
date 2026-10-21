'use client';
import { useEffect, useRef, useState } from 'react';
import { completeEmailLink, completeGoogleRedirect, firebaseClientAvailable, sendEmailLink, signInWithGoogle, watchUser } from '@/lib/firebase/client';
import { googleFailure, prefersRedirect, type GoogleFailure } from '@/lib/firebase/google';

type State =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent'; email: string }
  | { kind: 'error'; message: string }
  | { kind: 'signed-in'; email: string | null };

const WORKSPACE = '/institutional/workspace';

function friendly(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  if (code === 'auth/operation-not-allowed') return 'Email-link sign-in is not enabled for this project yet.';
  if (code === 'auth/unauthorized-continue-uri' || code === 'auth/unauthorized-domain') return 'This address is not an authorised sign-in domain for the project.';
  if (code === 'auth/invalid-action-code' || code === 'auth/expired-action-code') return 'This sign-in link has expired or was already used. Request a new one.';
  if (code === 'auth/invalid-email') return 'That is not a valid email address.';
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
      if ((await signInWithGoogle(effective)) === 'done') window.location.assign(WORKSPACE);
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

export function SignIn() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<State>({ kind: 'idle' });
  const available = firebaseClientAvailable();

  useEffect(() => {
    if (!available) return;
    let off: (() => void) | undefined;
    (async () => {
      try {
        const r = await completeEmailLink(window.location.href, () => window.prompt('Confirm the email address the link was sent to') || null);
        if (r.done) {
          window.history.replaceState(null, '', window.location.pathname);
          window.location.assign(WORKSPACE);
          return;
        }
      } catch (e) {
        setState({ kind: 'error', message: friendly(e) });
      }
      try {
        if (await completeGoogleRedirect()) {
          window.location.assign(WORKSPACE);
          return;
        }
      } catch (e) {
        setState({ kind: 'error', message: googleFailure(e, window.location.origin).message });
      }
      off = await watchUser((u) => {
        if (u) setState({ kind: 'signed-in', email: u.email });
      });
    })();
    return () => off?.();
  }, [available]);

  if (!available) return <p className="ws-msg ws-msg--error" role="status">Sign-in is not configured on this deployment.</p>;
  if (state.kind === 'signed-in')
    return (
      <p className="ws-msg" role="status">
        Signed in as {state.email}. <a href={WORKSPACE}>Open the workspace</a>.
      </p>
    );

  return (
    <div className="ws-panel ws-signin">
      <GoogleSignIn />
      <p className="ws-or"><span>or</span></p>
      <form
        className="ws-form"
        onSubmit={async (ev) => {
          ev.preventDefault();
          setState({ kind: 'sending' });
          try {
            await sendEmailLink(email.trim(), `${window.location.origin}${WORKSPACE}/sign-in`);
            setState({ kind: 'sent', email: email.trim() });
          } catch (e) {
            setState({ kind: 'error', message: friendly(e) });
          }
        }}
      >
        <label>
          Email address
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <div className="ws-row">
          <button className="button button--solid" type="submit" disabled={state.kind === 'sending'}>
            {state.kind === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
          </button>
        </div>
        <p className="ws-hint">The link is valid once and for a limited time. Open it in this browser.</p>
        <div aria-live="polite">
          {state.kind === 'sent' ? <p className="ws-msg">A sign-in link was sent to {state.email}.</p> : null}
          {state.kind === 'error' ? <p className="ws-msg ws-msg--error">{state.message}</p> : null}
        </div>
      </form>
    </div>
  );
}
