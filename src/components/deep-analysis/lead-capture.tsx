'use client';
/**
 * Optional "About you" panel on Deep Analysis, for signed-in users: organisation, role and an unticked opt-in to be
 * contacted about a Decision Room pilot. Never blocks an analysis; can be skipped (for this browser session);
 * not shown again once a profile exists, only a one-line summary with Change and Remove.
 */
import { useEffect, useId, useState } from 'react';
import { ORG_MAX, PILOT_CONSENT_TEXT, ROLES, checkProfile, roleLabel, type ProfileInput } from '@/lib/leads/profile';
import { PRIVACY_VERSION } from '@/lib/site/privacy-version';
import type { StoredProfile } from '@/lib/leads/client';

export interface LeadUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
}

const SKIP_KEY = 'am.da.profile.skipped';

export function LeadCapture({ user }: { user: LeadUser | null }) {
  const id = useId();
  const [profile, setProfile] = useState<StoredProfile | null | undefined>(undefined);
  const [skipped, setSkipped] = useState(false);
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState<ProfileInput>({ organisation: '', role: '', pilotInterest: false });
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    setProfile(undefined);
    setNote(null);
    if (!user) return;
    try {
      setSkipped(window.sessionStorage.getItem(SKIP_KEY) === user.uid);
    } catch {
      /* storage unavailable: ask */
    }
    let live = true;
    import('@/lib/leads/client')
      .then(({ loadProfile }) => loadProfile(user.uid))
      .then((p) => live && setProfile(p))
      // Unreadable (rules not deployed, offline): stay out of the way.
      .catch(() => live && setProfile(null));
    return () => {
      live = false;
    };
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user || profile === undefined) return null;

  const startEdit = () => {
    setInput(profile ? { organisation: profile.organisation, role: profile.role, pilotInterest: profile.pilotInterest } : { organisation: '', role: '', pilotInterest: false });
    setError(null);
    setEditing(true);
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const email = user.emailVerified && user.email ? user.email : null;
    const checked = checkProfile(input, email, PRIVACY_VERSION);
    if (!checked.ok) return setError({ field: checked.field, message: checked.message });
    setBusy(true);
    setError(null);
    try {
      const { saveProfile } = await import('@/lib/leads/client');
      await saveProfile(user.uid, checked.fields, profile !== null);
      setProfile({ ...checked.fields, updatedAt: new Date().toISOString() });
      setEditing(false);
      setNote('Saved. Thank you.');
    } catch {
      setError({ message: 'Your details could not be saved. Your analysis is not affected; please try again later.' });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!user) return;
    setBusy(true);
    try {
      const { deleteProfile } = await import('@/lib/leads/client');
      await deleteProfile(user.uid);
      setProfile(null);
      setEditing(false);
      setSkipped(true);
      setNote('Your organisation, role and pilot preference have been removed.');
    } catch {
      setError({ message: 'Your details could not be removed. Please try again later.' });
    } finally {
      setBusy(false);
    }
  }

  function skip() {
    try {
      window.sessionStorage.setItem(SKIP_KEY, user!.uid);
    } catch {
      /* ignore */
    }
    setSkipped(true);
    setEditing(false);
  }

  if (profile && !editing) {
    return (
      <p className="da-lead-line" aria-live="polite">
        {note ? <span>{note} </span> : null}
        <span className="da-muted-inline">
          Profile: {profile.organisation} · {roleLabel(profile.role)}
          {profile.pilotInterest ? ' · pilot conversation requested' : ''}.
        </span>{' '}
        <button type="button" className="da-linkish" onClick={startEdit}>Change</button>{' '}
        <button type="button" className="da-linkish" onClick={remove} disabled={busy}>Remove</button>
      </p>
    );
  }
  if (!profile && skipped && !editing) return note ? <p className="da-lead-line" aria-live="polite">{note}</p> : null;

  return (
    <form className="da-lead ws-form" onSubmit={save} aria-labelledby={`${id}-h`} noValidate>
      <div className="da-lead__head">
        <h2 id={`${id}-h`}>About you <span className="da-lead__opt">optional</span></h2>
        <p className="da-muted">So that the analysis and our follow-up fit your work. Your analysis runs whether or not you answer.</p>
      </div>
      <div className="da-lead__fields">
        <label htmlFor={`${id}-org`}>
          Organisation
          <input
            id={`${id}-org`}
            type="text"
            autoComplete="organization"
            maxLength={ORG_MAX}
            value={input.organisation}
            aria-invalid={error?.field === 'organisation' || undefined}
            aria-describedby={error?.field === 'organisation' ? `${id}-err` : undefined}
            onChange={(e) => setInput({ ...input, organisation: e.target.value })}
          />
        </label>
        <label htmlFor={`${id}-role`}>
          Role
          <select
            id={`${id}-role`}
            value={input.role}
            aria-invalid={error?.field === 'role' || undefined}
            aria-describedby={error?.field === 'role' ? `${id}-err` : undefined}
            onChange={(e) => setInput({ ...input, role: e.target.value as ProfileInput['role'] })}
          >
            <option value="">Select…</option>
            {ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </label>
      </div>
      <label className="da-check">
        <input type="checkbox" checked={input.pilotInterest} onChange={(e) => setInput({ ...input, pilotInterest: e.target.checked })} /> {PILOT_CONSENT_TEXT}
      </label>
      <p className="da-terms">
        Stored with your account in the EU, visible only to you and the operator, and never shared or sold. Remove it at any time here. See the <a href="/privacy#profile">privacy notice</a>.
      </p>
      {error ? <p className="ws-msg ws-msg--error" role="alert" id={`${id}-err`}>{error.message}</p> : null}
      <div className="da-row">
        <button type="submit" className="da-btn" disabled={busy}>Save</button>
        {profile ? (
          <button type="button" className="da-linkish" onClick={() => setEditing(false)}>Cancel</button>
        ) : (
          <button type="button" className="da-linkish" onClick={skip}>Skip for now</button>
        )}
      </div>
    </form>
  );
}
