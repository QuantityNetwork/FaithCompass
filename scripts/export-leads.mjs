#!/usr/bin/env node
/**
 * Owner-only export of the optional Deep Analysis profiles (user_profiles/{uid}) as CSV or JSON.
 *
 *   node scripts/export-leads.mjs                 all profiles, CSV on stdout
 *   node scripts/export-leads.mjs --pilot-only    only users who ticked "I'd like to talk about a Decision Room pilot"
 *   node scripts/export-leads.mjs --json          JSON instead of CSV
 *
 * The app cannot list profiles (firestore.rules: `allow list: if false`). This script reads them with the operator's
 * own Google Cloud identity, through IAM, which the rules do not govern:
 *   - FIRESTORE_ACCESS_TOKEN, if set (an OAuth access token of a project owner/viewer), or
 *   - `gcloud auth print-access-token` (after `gcloud auth login` as a project owner).
 * Against the emulator (FIRESTORE_EMULATOR_HOST set) it uses the emulator's admin bypass and never touches the
 * real project. Nothing is written; the token is never printed. Treat the output as personal data: keep it off
 * shared drives and delete it when done. Only contact users with pilotInterest = true.
 */
import { execFileSync } from 'node:child_process';

const PROJECT = process.env.FIREBASE_PROJECT_ID || 'abrahammoses-a0a26';
const EMULATOR = process.env.FIRESTORE_EMULATOR_HOST || '';
const args = new Set(process.argv.slice(2));
const pilotOnly = args.has('--pilot-only');
const asJson = args.has('--json');

function token() {
  if (EMULATOR) return 'owner';
  if (process.env.FIRESTORE_ACCESS_TOKEN) return process.env.FIRESTORE_ACCESS_TOKEN.trim();
  try {
    return execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    console.error('No credentials: set FIRESTORE_ACCESS_TOKEN or sign in with `gcloud auth login` as a project owner.');
    process.exit(2);
  }
}

const base = EMULATOR
  ? `http://${EMULATOR}/v1/projects/${PROJECT}/databases/(default)/documents`
  : `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

const val = (v) =>
  v == null ? null : 'stringValue' in v ? v.stringValue : 'booleanValue' in v ? v.booleanValue : 'timestampValue' in v ? v.timestampValue : 'nullValue' in v ? null : 'integerValue' in v ? Number(v.integerValue) : null;

const COLUMNS = ['uid', 'email', 'organisation', 'role', 'pilotInterest', 'consentVersion', 'privacyVersion', 'createdAt', 'updatedAt'];

async function main() {
  const auth = { authorization: `Bearer ${token()}` };
  const rows = [];
  let pageToken = '';
  do {
    const url = `${base}/user_profiles?pageSize=300${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
    const res = await fetch(url, { headers: auth });
    if (!res.ok) {
      console.error(`Firestore answered ${res.status}. Check that the account has access to project ${PROJECT}.`);
      process.exit(1);
    }
    const body = await res.json();
    for (const d of body.documents ?? []) {
      const f = Object.fromEntries(Object.entries(d.fields ?? {}).map(([k, v]) => [k, val(v)]));
      rows.push({ uid: d.name.split('/').pop(), ...f });
    }
    pageToken = body.nextPageToken ?? '';
  } while (pageToken);

  const out = rows.filter((r) => !pilotOnly || r.pilotInterest === true).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  if (asJson) {
    process.stdout.write(`${JSON.stringify(out.map((r) => Object.fromEntries(COLUMNS.map((c) => [c, r[c] ?? null]))), null, 2)}\n`);
    return;
  }
  const cell = (v) => {
    const s = v == null ? '' : String(v);
    // Quote, and neutralise spreadsheet formulas in user-typed text.
    return `"${(/^[=+\-@\t\r]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
  };
  process.stdout.write(`${COLUMNS.join(',')}\n${out.map((r) => COLUMNS.map((c) => cell(r[c])).join(',')).join('\n')}${out.length ? '\n' : ''}`);
  console.error(`${out.length} profile(s)${pilotOnly ? ' with pilot interest' : ''}.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
