/**
 * firestore.rules for the optional Deep Analysis profile (user_profiles/{uid}) against the emulator: only the user
 * reads, writes or deletes their own profile; every field is validated; times come from the server clock; the email
 * is the user's own verified address; nobody lists profiles. Runs only under `npm run test:firestore`.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { DOCS, ON_EMULATOR, PROJECT, clearEmulator, client, mockToken } from './emulator';

const OK = 200;
const DENIED = 403;

const alice = mockToken('alice', { email: 'alice@bank.example', email_verified: true }, 'google.com');
const aliceUnverified = mockToken('alice', { email: 'alice@bank.example', email_verified: false });
const bob = mockToken('bob', { email: 'bob@insurer.example', email_verified: true });
const anon = mockToken('anon-1', {}, 'anonymous');
const editor = mockToken('ed', { am_role: 'editorial_admin', am_tenants: { t1: 'editor' } });

type Val = string | boolean | null | number;
const enc = (v: Val) =>
  v === null ? { nullValue: null } : typeof v === 'boolean' ? { booleanValue: v } : typeof v === 'number' ? { integerValue: String(v) } : { stringValue: v };

const profile = (o: Record<string, Val> = {}): Record<string, Val> => ({
  organisation: 'Example Sparbank',
  role: 'credit_risk',
  pilotInterest: false,
  consentVersion: 'pilot-contact-1',
  privacyVersion: '1.3',
  email: 'alice@bank.example',
  source: 'deep-analysis',
  ...o,
});

/**
 * A write as the browser SDK makes it: fields plus server-clock transforms for createdAt/updatedAt (serverTimestamp).
 * `times`: which fields get the request time; `literal` sets them to a fixed client value instead.
 */
async function write(token: string | null, uid: string, data: Record<string, Val>, opts: { times?: string[]; literal?: Record<string, string>; mask?: string[]; exists?: boolean } = {}) {
  const times = opts.times ?? ['createdAt', 'updatedAt'];
  const fields: Record<string, unknown> = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, enc(v)]));
  for (const [k, v] of Object.entries(opts.literal ?? {})) fields[k] = { timestampValue: v };
  const res = await fetch(`${DOCS}:commit`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({
      writes: [
        {
          update: { name: `projects/${PROJECT}/databases/(default)/documents/user_profiles/${uid}`, fields },
          ...(opts.mask ? { updateMask: { fieldPaths: opts.mask } } : {}),
          ...(opts.exists === undefined ? {} : { currentDocument: { exists: opts.exists } }),
          updateTransforms: times.map((fieldPath) => ({ fieldPath, setToServerValue: 'REQUEST_TIME' })),
        },
      ],
    }),
  });
  return res.status;
}

async function list(token: string | null) {
  const res = await fetch(`${DOCS}:runQuery`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'user_profiles' }] } }),
  });
  return res.status;
}

describe.skipIf(!ON_EMULATOR)('Deep Analysis profile rules (emulator)', () => {
  beforeEach(async () => {
    await clearEmulator();
  });

  it('lets a signed-in user create, read, update and delete their own profile', async () => {
    expect(await write(alice, 'alice', profile(), { exists: false })).toBe(OK);
    expect(await client.get(alice, 'user_profiles/alice')).toBe(OK);
    // Update: createdAt untouched (masked out), updatedAt from the server clock.
    const changed = profile({ organisation: 'Example Sparbank AB', role: 'compliance', pilotInterest: true });
    const mask = Object.keys(changed).concat('updatedAt');
    expect(await write(alice, 'alice', changed, { times: ['updatedAt'], mask })).toBe(OK);
    expect(await client.commit(alice, [{ path: 'user_profiles/alice', data: {}, del: true }])).toBe(OK);
    expect(await client.get(alice, 'user_profiles/alice')).toBe(404); // deleted; reading it is allowed and finds nothing
  });

  it('accepts a profile without an email (unverified address) and an "other" role', async () => {
    expect(await write(aliceUnverified, 'alice', profile({ email: null, role: 'other' }))).toBe(OK);
  });

  it('keeps profiles private: no one else reads, writes, deletes or lists them', async () => {
    expect(await write(alice, 'alice', profile())).toBe(OK);
    for (const t of [bob, editor, anon, null]) {
      expect(await client.get(t, 'user_profiles/alice')).toBe(DENIED);
      expect(await write(t, 'alice', profile())).toBe(DENIED);
      expect(await client.commit(t, [{ path: 'user_profiles/alice', data: {}, del: true }])).toBe(DENIED);
    }
    for (const t of [alice, bob, editor, null]) expect(await list(t)).toBe(DENIED);
  });

  it('refuses anonymous sign-ins and writing at another uid', async () => {
    expect(await write(anon, 'anon-1', profile({ email: null }))).toBe(DENIED);
    expect(await write(alice, 'bob', profile())).toBe(DENIED);
  });

  it('validates every field', async () => {
    const bad: Record<string, Val>[] = [
      profile({ organisation: '' }),
      profile({ organisation: 'x'.repeat(161) }),
      profile({ organisation: 42 }),
      profile({ role: 'ceo' }),
      profile({ pilotInterest: 'yes' }),
      profile({ consentVersion: '' }),
      profile({ privacyVersion: 'x'.repeat(21) }),
      profile({ source: 'elsewhere' }),
      profile({ email: 'someone-else@bank.example' }),
      profile({ extra: 'field' }),
    ];
    for (const b of bad) expect(await write(alice, 'alice', b), JSON.stringify(b).slice(0, 80)).toBe(DENIED);
    const { email: _e, ...noEmail } = profile();
    expect(await write(alice, 'alice', noEmail)).toBe(DENIED); // every field is required
  });

  it('refuses an email that is not the verified address of the token', async () => {
    expect(await write(aliceUnverified, 'alice', profile())).toBe(DENIED);
  });

  it('takes the times from the server clock only, and never rewrites createdAt', async () => {
    expect(await write(alice, 'alice', profile(), { times: [], literal: { createdAt: '2020-01-01T00:00:00Z', updatedAt: '2020-01-01T00:00:00Z' } })).toBe(DENIED);
    expect(await write(alice, 'alice', profile(), { times: ['updatedAt'], literal: { createdAt: '2020-01-01T00:00:00Z' } })).toBe(DENIED);
    expect(await write(alice, 'alice', profile())).toBe(OK);
    // An update that sets createdAt again (to the new request time) changes it: refused.
    expect(await write(alice, 'alice', profile({ pilotInterest: true }))).toBe(DENIED);
  });
});

describe.skipIf(!ON_EMULATOR)('scripts/export-leads.mjs (emulator)', () => {
  it('exports profiles as CSV, optionally only those with pilot interest, and neutralises formulas', async () => {
    await clearEmulator();
    expect(await write(alice, 'alice', profile({ organisation: '=HYPERLINK("x")', pilotInterest: true }))).toBe(OK);
    expect(await write(bob, 'bob', profile({ email: 'bob@insurer.example', organisation: 'Example Försäkring', role: 'legal_gc' }))).toBe(OK);
    const { execFileSync } = await import('node:child_process');
    const run = (...a: string[]) => execFileSync('node', ['scripts/export-leads.mjs', ...a], { encoding: 'utf8', env: { ...process.env }, stdio: ['ignore', 'pipe', 'ignore'] });
    const all = run();
    expect(all.split('\n')[0]).toBe('uid,email,organisation,role,pilotInterest,consentVersion,privacyVersion,createdAt,updatedAt');
    expect(all).toContain('"bob","bob@insurer.example","Example Försäkring","legal_gc","false"');
    expect(all).toContain(`"'=HYPERLINK(""x"")"`);
    const pilot = run('--pilot-only');
    expect(pilot).toContain('"alice"');
    expect(pilot).not.toContain('"bob"');
    const json = JSON.parse(run('--json'));
    expect(json).toHaveLength(2);
    expect(json[0].createdAt).toMatch(/^\d{4}-\d\d-\d\dT/);
  });
});
