/**
 * Master Prompt 3, §3 acceptance tests 1-7, at the application layer.
 *
 * These run against DurableTestStore, an in-process stand-in for a database.
 * What they prove: the routes and the editorial workflow never let an
 * anonymous or unauthorised request change the published record. What they do
 * not prove: that Postgres row-level security enforces the same rules if
 * someone bypasses the application. Those cases are listed at the bottom as
 * BLOCKED (they need a real Supabase project) and are skipped, not passed.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runAnalysis } from '@/lib/evidence/pipeline';
import { CorpusReasoningProvider } from '@/lib/evidence/providers/corpus';
import { setStore } from '@/lib/evidence/store';
import { DANIEL_12_1 } from '@/lib/evidence/seed/daniel-12-1';
import { decideProposal, proposeChallenge, RevisionError } from '@/lib/evidence/revisions';
import { setTokenVerifier, resolveActor, type Actor } from '@/lib/auth/actor';
import { can, ROLES, PERMISSIONS } from '@/lib/auth/roles';
import { resetWriteLimits } from '@/lib/security/write-guard';
import { setSecurityEventSink } from '@/lib/security/audit-log';
import type { Analysis } from '@/lib/evidence/schema';
import { DurableTestStore, MemoryStore } from './helpers/memory-store';
import { POST as challengeRoute } from '@/app/api/evidence/claims/[id]/challenge/route';
import { POST as analyzeRoute } from '@/app/api/evidence/analyze/route';
import { POST as decisionRoute } from '@/app/api/evidence/proposals/[id]/decision/route';
import { GET as listRoute } from '@/app/api/evidence/analyses/route';

const provider = new CorpusReasoningProvider();
const ORIGIN = 'http://localhost';
const ENV_KEYS = ['AUTH_PROVIDER', 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'] as const;

const anon: Actor = { id: null, role: 'public_reader', authenticated: false, via: 'none' };
const contributor: Actor = { id: 'user-contrib', role: 'research_contributor', authenticated: true, via: 'supabase' };
const editorA: Actor = { id: 'user-editor-a', role: 'research_editor', authenticated: true, via: 'supabase' };
const editorB: Actor = { id: 'user-editor-b', role: 'research_editor', authenticated: true, via: 'supabase' };
const sysadmin: Actor = { id: 'user-ops', role: 'system_admin', authenticated: true, via: 'supabase' };

let store: DurableTestStore;
let analysis: Analysis;
let events: Array<Record<string, unknown>>;
let savedEnv: Record<string, string | undefined>;

function post(path: string, body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ORIGIN, ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

/** Test identity provider: tokens map to fixed users. Stands in for Supabase Auth. */
function enableTestIdentityProvider(users: Record<string, { id: string; appRole: unknown }>) {
  process.env.AUTH_PROVIDER = 'supabase';
  process.env.SUPABASE_URL = 'https://example.invalid';
  process.env.SUPABASE_ANON_KEY = 'test-anon-key-not-a-secret';
  setTokenVerifier(async (token) => users[token] ?? null);
}
const bearer = (t: string) => ({ authorization: `Bearer ${t}` });
const TOKENS = {
  contrib: 'tok_contributor_aaaaaaaaaaaaaaaa',
  editorA: 'tok_editor_a_bbbbbbbbbbbbbbbbbbb',
  forged: 'tok_forged_cccccccccccccccccccccc',
};

beforeEach(async () => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  setTokenVerifier(null);
  resetWriteLimits();
  events = [];
  setSecurityEventSink((line) => events.push(JSON.parse(line)));
  store = new DurableTestStore();
  setStore(store);
  const r = await runAnalysis(
    { query: DANIEL_12_1.aliases[0], reference: DANIEL_12_1.reference, passageText: DANIEL_12_1.passageText },
    provider,
  );
  analysis = r.analysis!;
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k]!;
  }
  setTokenVerifier(null);
  setSecurityEventSink(null);
  setStore(null);
});

const published = async () => (await store.getAnalysis(analysis.id))!;

describe('roles', () => {
  it('defines the six roles and denies anything not granted', () => {
    expect(ROLES).toEqual(['public_reader', 'research_contributor', 'research_editor', 'scholarly_reviewer', 'editorial_admin', 'system_admin']);
    expect(can('public_reader', 'proposal.decide')).toBe(false);
    expect(can('research_contributor', 'proposal.decide')).toBe(false);
    expect(can('scholarly_reviewer', 'proposal.decide')).toBe(false);
    expect(can('system_admin', 'proposal.decide')).toBe(false);
    expect(can('system_admin', 'review.attest')).toBe(false);
    expect(can('research_editor', 'review.attest')).toBe(false);
    for (const r of ROLES) expect(can(r, 'record.read')).toBe(true);
    // Unknown permission: denied.
    expect(can('editorial_admin', 'nope' as (typeof PERMISSIONS)[number])).toBe(false);
  });
});

describe('§3 acceptance 1: anonymous users cannot alter canonical evidence', () => {
  it('an anonymous challenge becomes a proposal and leaves the published claim unchanged', async () => {
    const before = await published();
    const claim = before.claims[0];
    const res = await challengeRoute(post(`/api/evidence/claims/${claim.id}/challenge`, {}), ctx(claim.id));
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.publishedChanged).toBe(false);
    expect(body.proposal.status).toBe('proposed');
    expect(await published()).toEqual(before);
    expect(await store.listChallenges(claim.id)).toHaveLength(0);
    expect((await store.listProposals(claim.id))[0].proposedBy).toBeNull();
  });

  it('an anonymous analysis is saved as a draft, never into the published analyses', async () => {
    const before = await store.listAnalyses();
    const res = await analyzeRoute(post('/api/evidence/analyze', { query: 'Daniel 12:1' }));
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.kind).toBe('DRAFT');
    expect(body.published).toBe(false);
    expect(await store.listAnalyses()).toEqual(before);
    expect(await store.getDraft(body.draftId)).not.toBeNull();
  });

  it('an anonymous decision is refused (401) and the proposal stays undecided', async () => {
    const { proposal } = await proposeChallenge(analysis.claims[0].id, anon, { provider });
    const res = await decisionRoute(post(`/api/evidence/proposals/${proposal.id}/decision`, { decision: 'approve', reason: 'Looks right to me, approve.' }), ctx(proposal.id));
    expect(res.status).toBe(401);
    expect((await store.getProposal(proposal.id))!.status).toBe('proposed');
    expect(await published()).toEqual(analysis);
  });

  it('with no durable store every write answers 503 and nothing is kept', async () => {
    const mem = new MemoryStore();
    setStore(mem);
    await mem.saveAnalysis(analysis);
    const r1 = await challengeRoute(post(`/api/evidence/claims/${analysis.claims[0].id}/challenge`, {}), ctx(analysis.claims[0].id));
    const r2 = await analyzeRoute(post('/api/evidence/analyze', { query: 'Daniel 12:1' }));
    expect(r1.status).toBe(503);
    expect(r2.status).toBe(503);
    expect((await r1.json()).persisted).toBe(false);
    expect(await mem.listProposals(analysis.claims[0].id)).toHaveLength(0);
    expect(await mem.getAnalysis(analysis.id)).toEqual(analysis);
  });

  it('refuses cross-origin writes, non-JSON bodies, oversized bodies and floods', async () => {
    const id = analysis.claims[0].id;
    const evil = await challengeRoute(post(`/api/evidence/claims/${id}/challenge`, {}, { origin: 'https://evil.example' }), ctx(id));
    expect(evil.status).toBe(403);
    const nullOrigin = await challengeRoute(post(`/api/evidence/claims/${id}/challenge`, {}, { origin: 'null' }), ctx(id));
    expect(nullOrigin.status).toBe(403);
    const crossSite = new Request(`${ORIGIN}/api/evidence/claims/${id}/challenge`, { method: 'POST', headers: { 'content-type': 'application/json', 'sec-fetch-site': 'cross-site' }, body: '{}' });
    expect((await challengeRoute(crossSite, ctx(id))).status).toBe(403);
    const form = await challengeRoute(post(`/api/evidence/claims/${id}/challenge`, 'a=1', { 'content-type': 'text/plain' }), ctx(id));
    expect(form.status).toBe(415);
    const big = await analyzeRoute(post('/api/evidence/analyze', { query: 'x', passageText: 'y'.repeat(40_000) }));
    expect(big.status).toBe(413);

    resetWriteLimits();
    const codes: number[] = [];
    for (let i = 0; i < 7; i++) codes.push((await analyzeRoute(post('/api/evidence/analyze', { query: '' }))).status);
    expect(codes.slice(0, 5).every((c) => c === 400)).toBe(true);
    expect(codes.slice(5)).toEqual([429, 429]);
    expect(await published()).toEqual(analysis);
  });

  it('logs every refused write as a structured security event without the request text', async () => {
    await analyzeRoute(post('/api/evidence/analyze', { query: 'a private question' }, { origin: 'https://evil.example' }));
    const denied = events.find((e) => e.outcome === 'denied' && e.reason === 'origin_mismatch');
    expect(denied).toMatchObject({ type: 'security', action: 'analysis.draft', status: 403 });
    expect(JSON.stringify(events)).not.toContain('a private question');
    expect(String(denied!.client)).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe('§3 acceptance 2: contributors cannot self-approve', () => {
  it('a contributor cannot decide any proposal', async () => {
    const { proposal } = await proposeChallenge(analysis.claims[0].id, anon, { provider });
    await expect(decideProposal(proposal.id, 'approve', contributor, 'I think this is right.')).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('an editor cannot approve their own proposal', async () => {
    const { proposal } = await proposeChallenge(analysis.claims[0].id, editorA, { provider });
    await expect(decideProposal(proposal.id, 'approve', editorA, 'Approving my own work.')).rejects.toMatchObject({ code: 'self_approval' });
    expect(await published()).toEqual(analysis);
  });

  it('a system administrator has no editorial authority', async () => {
    const { proposal } = await proposeChallenge(analysis.claims[0].id, anon, { provider });
    await expect(decideProposal(proposal.id, 'approve', sysadmin, 'Ops approving content.')).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('through HTTP, an authenticated contributor gets 403 on the decision route', async () => {
    enableTestIdentityProvider({ [TOKENS.contrib]: { id: 'user-contrib', appRole: 'research_contributor' } });
    const res = await challengeRoute(post(`/api/evidence/claims/${analysis.claims[0].id}/challenge`, {}, bearer(TOKENS.contrib)), ctx(analysis.claims[0].id));
    const { proposal } = await res.json();
    const d = await decisionRoute(post(`/api/evidence/proposals/${proposal.id}/decision`, { decision: 'approve', reason: 'Self approval attempt.' }, bearer(TOKENS.contrib)), ctx(proposal.id));
    expect(d.status).toBe(403);
    expect((await store.getProposal(proposal.id))!.proposedBy).toBe('user-contrib');
    expect(await published()).toEqual(analysis);
  });
});

describe('§3 acceptance 3: roles cannot be forged through the request', () => {
  it('rejects role or approval fields in the body', async () => {
    const id = analysis.claims[0].id;
    const r = await challengeRoute(post(`/api/evidence/claims/${id}/challenge`, { role: 'editorial_admin', approved: true }), ctx(id));
    expect(r.status).toBe(400);
    const { proposal } = await proposeChallenge(id, anon, { provider });
    const d = await decisionRoute(post(`/api/evidence/proposals/${proposal.id}/decision`, { decision: 'approve', reason: 'Forged role in payload.', role: 'research_editor' }), ctx(proposal.id));
    expect([400, 401]).toContain(d.status);
    expect(await published()).toEqual(analysis);
  });

  it('ignores role headers and unverifiable tokens', async () => {
    const { proposal } = await proposeChallenge(analysis.claims[0].id, anon, { provider });
    const headers = { 'x-role': 'research_editor', 'x-user-role': 'editorial_admin', authorization: `Bearer ${TOKENS.forged}` };
    const d = await decisionRoute(post(`/api/evidence/proposals/${proposal.id}/decision`, { decision: 'approve', reason: 'Header forged role.' }, headers), ctx(proposal.id));
    expect(d.status).toBe(401); // no identity provider configured: everyone is a reader
    enableTestIdentityProvider({});
    const d2 = await decisionRoute(post(`/api/evidence/proposals/${proposal.id}/decision`, { decision: 'approve', reason: 'Header forged role.' }, headers), ctx(proposal.id));
    expect(d2.status).toBe(401); // token does not verify
    expect((await store.getProposal(proposal.id))!.status).toBe('proposed');
  });

  it('takes the role only from server-controlled metadata, never an unknown value', async () => {
    enableTestIdentityProvider({ [TOKENS.forged]: { id: 'u-x', appRole: 'superuser' }, [TOKENS.editorA]: { id: 'user-editor-a', appRole: 'research_editor' } });
    const a = await resolveActor(new Request(ORIGIN, { headers: bearer(TOKENS.forged) }));
    expect(a.role).toBe('research_contributor');
    const b = await resolveActor(new Request(ORIGIN, { headers: bearer(TOKENS.editorA) }));
    expect(b.role).toBe('research_editor');
  });

  it('offers no login when no identity provider is configured', async () => {
    const a = await resolveActor(new Request(ORIGIN, { headers: bearer(TOKENS.editorA) }));
    expect(a).toEqual(anon);
  });
});

describe('§3 acceptance 4: rejected revisions leave data unchanged', () => {
  it('rejection changes nothing published and is audited', async () => {
    const { proposal } = await proposeChallenge(analysis.claims[0].id, contributor, { provider });
    await decideProposal(proposal.id, 'reject', editorA, 'Counter-evidence not supported by sources.');
    expect(await published()).toEqual(analysis);
    expect(await store.listChallenges(analysis.claims[0].id)).toHaveLength(0);
    expect((await store.getProposal(proposal.id))!.status).toBe('rejected');
    const audit = await store.listAudit(proposal.id);
    expect(audit.find((a) => a.changeType === 'REJECTED')).toMatchObject({ actorId: 'user-editor-a', actorRole: 'research_editor' });
    // A rejected proposal cannot later be approved.
    await expect(decideProposal(proposal.id, 'approve', editorB, 'Trying to approve after rejection.')).rejects.toMatchObject({ code: 'invalid_state' });
  });
});

describe('§3 acceptance 5: concurrent edits cannot silently overwrite', () => {
  it('a proposal made against an older version is refused after another is approved', async () => {
    const c0 = analysis.claims[0].id;
    const c1 = analysis.claims[1].id;
    const p1 = (await proposeChallenge(c0, anon, { provider })).proposal;
    const p2 = (await proposeChallenge(c1, anon, { provider })).proposal;
    const first = await decideProposal(p1.id, 'approve', editorA, 'First approval, sources checked.');
    await expect(decideProposal(p2.id, 'approve', editorB, 'Second approval, stale base.')).rejects.toMatchObject({ code: 'conflict' });
    expect(await published()).toEqual(first.analysis);
    expect((await store.getProposal(p2.id))!.status).toBe('superseded');
  });

  it('two editors deciding the same proposal at once: exactly one wins', async () => {
    const { proposal } = await proposeChallenge(analysis.claims[0].id, anon, { provider });
    const results = await Promise.allSettled([
      decideProposal(proposal.id, 'approve', editorA, 'Approve: sources checked.'),
      decideProposal(proposal.id, 'reject', editorB, 'Reject: unsupported reading.'),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const failed = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(failed.reason).toBeInstanceOf(RevisionError);
  });

  it('an Idempotency-Key replay does not create a second proposal', async () => {
    const id = analysis.claims[0].id;
    const h = { 'idempotency-key': 'replay-key-123456' };
    const r1 = await challengeRoute(post(`/api/evidence/claims/${id}/challenge`, {}, h), ctx(id));
    const r2 = await challengeRoute(post(`/api/evidence/claims/${id}/challenge`, {}, h), ctx(id));
    expect(r1.status).toBe(202);
    expect(r2.status).toBe(200);
    expect(await store.listProposals(id)).toHaveLength(1);
  });
});

describe('§3 acceptance 6: approved changes create attributable, versioned audit events', () => {
  it('records who proposed, who approved, and the version moved from and to', async () => {
    const claim = analysis.claims[0];
    const { proposal } = await proposeChallenge(claim.id, contributor, { provider });
    const { analysis: after } = await decideProposal(proposal.id, 'approve', editorA, 'Sources re-checked; revision accepted.');
    expect(after.updatedAt).not.toBe(analysis.updatedAt);
    expect((await published()).claims[0].overallConfidence).toBe(proposal.challenge.revisedScore);

    const approved = (await store.listAudit(claim.id)).find((a) => a.changeType === 'APPROVED')!;
    expect(approved).toMatchObject({ actorId: 'user-editor-a', actorRole: 'research_editor', reason: 'Sources re-checked; revision accepted.' });
    expect(approved.oldValue).toMatchObject({ score: claim.overallConfidence, version: analysis.updatedAt });
    expect(approved.newValue).toMatchObject({ version: after.updatedAt, proposalId: proposal.id, proposedBy: 'user-contrib' });
    const proposed = (await store.listAudit(proposal.id)).find((a) => a.changeType === 'PROPOSED')!;
    expect(proposed).toMatchObject({ actorId: 'user-contrib', actorRole: 'research_contributor' });
  });
});

describe('§3 acceptance 7: public reading needs no registration', () => {
  it('lists published analyses without any credentials', async () => {
    const res = await listRoute();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.analyses.length).toBeGreaterThan(0);
  });
});

describe('BLOCKED: needs a real Supabase project (not passed)', () => {
  // Each needs Postgres with the Stage 2 migrations applied and Supabase Auth issuing
  // JWTs. See docs/RELEASE_BLOCKERS.md (B1, B2).
  it.skip('BLOCKED 1/3 (DB): the anon and authenticated Postgres roles cannot write canonical tables via PostgREST', () => {});
  it.skip('BLOCKED 2 (DB): RLS refuses an UPDATE of challenge_proposals.status by its author', () => {});
  it.skip('BLOCKED 5 (DB): two server instances deciding concurrently, serialised by the database', () => {});
  it.skip('BLOCKED 6 (DB): audit_events is append-only (UPDATE/DELETE refused) under the service role', () => {});
  it.skip('BLOCKED (DB): rate limits and quotas hold across serverless instances', () => {});
});
