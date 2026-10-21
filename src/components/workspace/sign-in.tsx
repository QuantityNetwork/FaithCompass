'use client';
import { useEffect, useState } from 'react';
import { completeEmailLink, firebaseClientAvailable, sendEmailLink, watchUser } from '@/lib/firebase/client';

type State = { kind: 'idle' } | { kind: 'sending' } | { kind: 'sent'; email: string } | { kind: 'error'; message: string } | { kind: 'signed-in'; email: string | null };

function friendly(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  if (code === 'auth/operation-not-allowed') return 'Email-link sign-in is not enabled for this project yet.';
  if (code === 'auth/unauthorized-continue-uri' || code === 'auth/unauthorized-domain') return 'This address is not an authorised sign-in domain for the project.';
  if (code === 'auth/invalid-action-code' || code === 'auth/expired-action-code') return 'This sign-in link has expired or was already used. Request a new one.';
  if (code === 'auth/invalid-email') return 'That is not a valid email address.';
  return 'Sign-in failed. Try again.';
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
          window.location.assign('/institutional/workspace');
          return;
        }
      } catch (e) {
        setState({ kind: 'error', message: friendly(e) });
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
        Signed in as {state.email}. <a href="/institutional/workspace">Open the workspace</a>.
      </p>
    );

  return (
    <form
      className="ws-form ws-panel"
      onSubmit={async (ev) => {
        ev.preventDefault();
        setState({ kind: 'sending' });
        try {
          await sendEmailLink(email.trim(), `${window.location.origin}/institutional/workspace/sign-in`);
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
  );
}
