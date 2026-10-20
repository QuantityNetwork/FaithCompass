#!/usr/bin/env node
/**
 * Assign an AbrahamMoses role (custom claim `am_role`) to a Firebase Auth user, without a service-account key.
 *
 * The owner runs it on his own machine with his own Google login (ADR 0001):
 *
 *   gcloud auth login
 *   ACCESS_TOKEN="$(gcloud auth print-access-token)" node scripts/set-role.mjs editor@example.org research_editor
 *
 * It calls the Identity Toolkit API (accounts:lookup, accounts:update) as that user; it needs the Firebase Admin or
 * Owner IAM role on the project. The token is read from the environment and never printed. The user must sign in
 * again (or refresh their ID token) before the new role applies. Against the Auth emulator, set
 * FIREBASE_AUTH_EMULATOR_HOST and no token is needed. `--role none` removes the claim.
 */
const ROLES = ['public_reader', 'research_contributor', 'research_editor', 'scholarly_reviewer', 'editorial_admin', 'system_admin'];
const PROJECT = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'abrahammoses-a0a26';

const [email, role] = process.argv.slice(2);
if (!email || !role || (role !== 'none' && !ROLES.includes(role))) {
  console.error(`usage: node scripts/set-role.mjs <email> <${ROLES.join('|')}|none>`);
  process.exit(2);
}

const emulator = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const base = emulator ? `http://${emulator}/identitytoolkit.googleapis.com/v1` : 'https://identitytoolkit.googleapis.com/v1';
const token = emulator ? 'owner' : process.env.ACCESS_TOKEN;
if (!token) {
  console.error('ACCESS_TOKEN is not set. Run: ACCESS_TOKEN="$(gcloud auth print-access-token)" node scripts/set-role.mjs ...');
  process.exit(2);
}
const headers = { 'content-type': 'application/json', authorization: `Bearer ${token}`, 'x-goog-user-project': PROJECT };

async function call(path, body) {
  const res = await fetch(`${base}/projects/${PROJECT}/${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status} ${json.error?.message ?? ''}`.trim());
  return json;
}

const found = await call('accounts:lookup', { email: [email] });
const user = found.users?.[0];
if (!user) {
  console.error(`No Firebase Auth user with that email in ${PROJECT}. The person must create an account first.`);
  process.exit(1);
}
const claims = JSON.parse(user.customAttributes || '{}');
if (role === 'none') delete claims.am_role;
else claims.am_role = role;
await call('accounts:update', { localId: user.localId, customAttributes: JSON.stringify(claims) });
console.log(`${email} (${user.localId}): am_role = ${claims.am_role ?? '(none: research_contributor by default)'} in ${PROJECT}. It applies at the user's next sign-in or token refresh.`);
