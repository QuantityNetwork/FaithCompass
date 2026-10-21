#!/usr/bin/env node
/**
 * Grant or revoke workspace roles (custom claim `am_tenants`) and the editorial role (`am_role`) with the Firebase
 * CLI only: no admin key, no service account. The project owner runs the CLI, logged in as themselves.
 *
 *   firebase auth:export users.json --format=json --project abrahammoses-a0a26
 *   node scripts/workspace-claims.mjs users.json import.json --email someone@example.org --tenant am-pilot=editor
 *   firebase auth:import import.json --project abrahammoses-a0a26
 *   rm users.json import.json
 *
 * Options (repeatable): --tenant <id>=member|editor, --remove-tenant <id>, --role <am_role>. Only the named account is
 * written to import.json; its other fields are kept as exported, so the re-import changes only the claims. The user
 * must refresh their ID token (sign out and in, or wait up to an hour) for the change to apply.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const [, , inFile, outFile, ...args] = process.argv;
const TENANT = /^[a-z0-9][a-z0-9-]{1,62}$/;
const ROLES = ['public_reader', 'research_contributor', 'research_editor', 'scholarly_reviewer', 'editorial_admin', 'system_admin'];
if (!inFile || !outFile) {
  console.error('usage: workspace-claims.mjs <export.json> <import.json> --email <address> [--tenant id=role]... [--remove-tenant id]... [--role am_role]');
  process.exit(2);
}
let email = null;
let role = null;
const add = {};
const remove = [];
for (let i = 0; i < args.length; i += 2) {
  const [k, v] = [args[i], args[i + 1]];
  if (k === '--email') email = v?.toLowerCase();
  else if (k === '--role') role = v;
  else if (k === '--tenant') {
    const [t, r] = (v ?? '').split('=');
    if (!TENANT.test(t) || !['member', 'editor'].includes(r)) throw new Error(`bad --tenant ${v}`);
    add[t] = r;
  } else if (k === '--remove-tenant') remove.push(v);
  else throw new Error(`unknown option ${k}`);
}
if (!email) throw new Error('--email is required');
if (role && !ROLES.includes(role)) throw new Error(`unknown role ${role}`);
const users = JSON.parse(readFileSync(inFile, 'utf8')).users ?? [];
const user = users.find((u) => (u.email ?? '').toLowerCase() === email);
if (!user) {
  console.error(`No account for ${email}. The person signs in once (email link) to create it, then run this again.`);
  process.exit(1);
}
const claims = user.customAttributes ? JSON.parse(user.customAttributes) : {};
const tenants = { ...(claims.am_tenants ?? {}), ...add };
for (const t of remove) delete tenants[t];
if (Object.keys(tenants).length) claims.am_tenants = tenants;
else delete claims.am_tenants;
if (role) claims.am_role = role;
user.customAttributes = JSON.stringify(claims);
writeFileSync(outFile, JSON.stringify({ users: [user] }, null, 2));
console.log(`${email}: claims now ${user.customAttributes}`);
