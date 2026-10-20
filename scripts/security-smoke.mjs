#!/usr/bin/env node
/**
 * Real-HTTP security smoke test: anonymous and forged writes must not change
 * the published record.
 *
 *   node scripts/security-smoke.mjs https://<deployment>
 *
 * For a deployment behind Vercel Deployment Protection, set
 * VERCEL_PROTECTION_BYPASS (sent as x-vercel-protection-bypass) or
 * SMOKE_COOKIE (sent as Cookie). Neither is logged.
 *
 * Read-only apart from the anonymous POSTs under test. Mutation oracle: the
 * public analyses list (ids, updatedAt, claim and source counts) before and
 * after; any canonical write moves updatedAt.
 */
const base = (process.argv[2] || process.env.SMOKE_BASE_URL || '').replace(/\/$/, '');
if (!base) {
  console.error('usage: node scripts/security-smoke.mjs <base-url>');
  process.exit(2);
}
const auth = {};
if (process.env.VERCEL_PROTECTION_BYPASS) auth['x-vercel-protection-bypass'] = process.env.VERCEL_PROTECTION_BYPASS;
if (process.env.SMOKE_COOKIE) auth.cookie = process.env.SMOKE_COOKIE;
const origin = new URL(base).origin;

async function req(path, init = {}) {
  const res = await fetch(base + path, { redirect: 'manual', ...init, headers: { ...auth, ...(init.headers || {}) } });
  let body = null;
  const text = await res.text();
  try { body = JSON.parse(text); } catch { body = text.slice(0, 200); }
  return { status: res.status, body, text };
}
const json = (extra = {}) => ({ 'content-type': 'application/json', origin, ...extra });
const post = (path, body, headers) => req(path, { method: 'POST', headers: json(headers), body: typeof body === 'string' ? body : JSON.stringify(body) });

async function snapshot() {
  const r = await req('/api/evidence/analyses');
  if (r.status !== 200) throw new Error(`GET /api/evidence/analyses -> ${r.status} (protected deployment? set VERCEL_PROTECTION_BYPASS)`);
  return JSON.stringify(r.body.analyses.map((a) => [a.id, a.updatedAt, a.claimCount, a.sourceCount, a.reviewState]).sort());
}

const results = [];
function check(name, ok, detail, { informational = false } = {}) {
  if (informational) {
    console.log(`${ok ? 'INFO' : 'WARN'}  ${name}  (${detail})`);
    return;
  }
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (${detail})`);
}

const before = await snapshot();
const page = await req('/evidence/daniel/12/1');
const claimId = /\/evidence\/claim\/([A-Za-z0-9._:-]+)/.exec(page.text)?.[1] ?? 'claim-not-found';
check('public read needs no registration', true, `analyses list 200; claim under test: ${claimId}`);

let r = await post('/api/evidence/analyze', { query: 'Daniel 12:1' });
check('anonymous analyze is refused or kept as an unpublished draft', r.status === 401 || r.status === 503 || (r.status === 202 && r.body?.published === false), `status ${r.status}`);
r = await post('/api/evidence/analyze', { query: 'Daniel 12:1', role: 'editorial_admin', publish: true });
check('analyze rejects role/publish fields in the payload', r.status === 400 || r.status === 429, `status ${r.status}`);

r = await post(`/api/evidence/claims/${claimId}/challenge`, {}, { 'idempotency-key': `smoke-${Date.now()}` });
check('anonymous challenge is refused or recorded as a proposal only', r.status === 401 || r.status === 503 || ((r.status === 202 || r.status === 200) && r.body?.publishedChanged === false), `status ${r.status}`);
r = await post(`/api/evidence/claims/${claimId}/challenge`, { role: 'editorial_admin', approved: true }, { 'x-role': 'editorial_admin' });
check('challenge rejects a forged role in body/header', r.status === 400, `status ${r.status}`);
r = await post(`/api/evidence/claims/${claimId}/challenge`, {}, { origin: 'https://evil.example' });
check('cross-origin challenge refused (CSRF)', r.status === 403, `status ${r.status}`);
r = await req(`/api/evidence/claims/${claimId}/challenge`, { method: 'POST', headers: { 'content-type': 'text/plain', origin }, body: '{}' });
check('non-JSON (form-style) challenge refused', r.status === 415, `status ${r.status}`);

const fakeProposal = '00000000-0000-4000-8000-000000000000';
r = await post(`/api/evidence/proposals/${fakeProposal}/decision`, { decision: 'approve', reason: 'Smoke test: anonymous approval attempt.' });
check('anonymous approval refused (401)', r.status === 401, `status ${r.status}`);
r = await post(`/api/evidence/proposals/${fakeProposal}/decision`, { decision: 'approve', reason: 'Smoke test: forged headers.' }, { 'x-role': 'research_editor', 'x-user-role': 'editorial_admin', authorization: 'Bearer forged.token.value.aaaaaaaaaaaaaaaaaaaa' });
check('forged role headers and unverifiable bearer refused (401)', r.status === 401, `status ${r.status}`);

const flood = [];
for (let i = 0; i < 8; i++) flood.push((await post('/api/evidence/analyze', { query: '' })).status);
// Informational: the limiter is per client address and per instance. A test
// runner whose egress address rotates, or a request spread over several
// instances, will not trip it; that is a finding about the limiter (durable
// limits need the database), not a pass or fail of the mutation checks.
check('write rate limit engaged from this client', flood.includes(429), `statuses ${flood.join(',')}`, { informational: true });

const after = await snapshot();
check('published analyses unchanged after all anonymous writes', before === after, before === after ? 'identical' : 'CHANGED');

const failed = results.filter((x) => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed against ${origin}`);
process.exit(failed.length ? 1 : 0);
