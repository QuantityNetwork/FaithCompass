-- Row-level security and append-only tests for the migrations, run as the
-- Supabase API roles. LOCAL PostgreSQL only (see run-local.sh); a pass here is
-- not a pass on Supabase.
\set ON_ERROR_STOP on
SET client_min_messages = notice;

CREATE SCHEMA IF NOT EXISTS t;
GRANT USAGE ON SCHEMA t TO anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION t.expect_error(label text, stmt text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'PASS (refused) %: %', label, SQLERRM;
    RETURN;
  END;
  RAISE EXCEPTION 'FAIL %: statement was allowed: %', label, stmt;
END $$;
CREATE OR REPLACE FUNCTION t.expect_rows(label text, stmt text, n int) RETURNS void LANGUAGE plpgsql AS $$
DECLARE got int;
BEGIN
  EXECUTE stmt;
  GET DIAGNOSTICS got = ROW_COUNT;
  IF got <> n THEN RAISE EXCEPTION 'FAIL %: % rows, expected %', label, got, n; END IF;
  RAISE NOTICE 'PASS %: % rows', label, got;
END $$;
CREATE OR REPLACE FUNCTION t.act_as(uid text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claim.sub', coalesce(uid, ''), false);
$$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA t TO anon, authenticated, service_role;

-- Fixture, as the service (BYPASSRLS). Ids are test values, not people.
\set editor_a '''00000000-0000-0000-0000-00000000000a'''
\set editor_b '''00000000-0000-0000-0000-00000000000b'''
\set contrib  '''00000000-0000-0000-0000-00000000000c'''
\set admin    '''00000000-0000-0000-0000-0000000000ad'''
SET ROLE service_role;
INSERT INTO public.role_grants (user_id, role, granted_by) VALUES
  (:editor_a, 'research_editor', :admin), (:editor_b, 'research_editor', :admin),
  (:contrib, 'research_contributor', :admin);
INSERT INTO public.works (id, title, work_type) VALUES ('work:test-daniel', 'Daniel (test)', 'scripture');
INSERT INTO public.claims (id, claim_type) VALUES ('claim:test-1', 'HISTORICAL');
INSERT INTO public.claim_revisions (id, claim_id, version, statement, state, created_by)
  VALUES ('rev:test-1-v1', 'claim:test-1', 1, 'Published statement', 'draft', :editor_a);
UPDATE public.claim_revisions SET state = 'editorial_review' WHERE id = 'rev:test-1-v1';
SELECT t.act_as(:editor_b);
UPDATE public.claim_revisions SET state = 'editor_approved' WHERE id = 'rev:test-1-v1';
UPDATE public.claim_revisions SET state = 'published' WHERE id = 'rev:test-1-v1';
UPDATE public.claims SET current_revision_id = 'rev:test-1-v1' WHERE id = 'claim:test-1';
INSERT INTO public.evidence_analyses (id, resource_id, resource_type, title, analysis_version, prompt_version, model_provider, model_version, data)
  VALUES ('analysis-test', 'r', 'PASSAGE', 'T', '1', '1', 'corpus', 'v', '{"updatedAt":"2026-01-01T00:00:00.000Z"}');
RESET ROLE;

-- §3.1 / §3.7: anonymous reads published work, cannot write anything.
SET ROLE anon; SELECT t.act_as(NULL);
SELECT t.expect_rows('anon reads published revision', $q$SELECT * FROM public.claim_revisions WHERE id = 'rev:test-1-v1'$q$, 1);
SELECT t.expect_rows('anon reads published analyses', $q$SELECT * FROM public.evidence_analyses$q$, 1);
SELECT t.expect_error('anon insert claim revision', $q$INSERT INTO public.claim_revisions (id, claim_id, version, statement) VALUES ('rev:x', 'claim:test-1', 2, 'x')$q$);
SELECT t.expect_error('anon update analysis', $q$UPDATE public.evidence_analyses SET title = 'pwned'$q$);
SELECT t.expect_error('anon insert proposal', $q$INSERT INTO public.challenge_proposals (claim_id, base_revision_id, payload) VALUES ('claim:test-1', 'rev:test-1-v1', '{}')$q$);
SELECT t.expect_error('anon read legacy proposals', $q$SELECT * FROM public.evidence_challenge_proposals$q$);
SELECT t.expect_error('anon grant self a role', $q$INSERT INTO public.role_grants (user_id, role, granted_by) VALUES (gen_random_uuid(), 'editorial_admin', gen_random_uuid())$q$);
RESET ROLE;

-- §3.2: a contributor proposes as themselves and cannot decide.
SET ROLE authenticated; SELECT t.act_as(:contrib);
SELECT t.expect_rows('contributor proposes as self', $q$INSERT INTO public.challenge_proposals (id, claim_id, base_revision_id, proposed_by, payload) VALUES ('11111111-1111-1111-1111-111111111111', 'claim:test-1', 'rev:test-1-v1', '00000000-0000-0000-0000-00000000000c', '{}')$q$, 1);
SELECT t.expect_error('contributor proposes as someone else', $q$INSERT INTO public.challenge_proposals (claim_id, base_revision_id, proposed_by, payload) VALUES ('claim:test-1', 'rev:test-1-v1', '00000000-0000-0000-0000-00000000000b', '{}')$q$);
SELECT t.expect_rows('contributor cannot approve own proposal', $q$UPDATE public.challenge_proposals SET status = 'approved', decided_by = '00000000-0000-0000-0000-00000000000c', decided_at = now() WHERE id = '11111111-1111-1111-1111-111111111111'$q$, 0);
SELECT t.expect_error('contributor cannot write canonical revisions', $q$INSERT INTO public.claim_revisions (id, claim_id, version, statement, created_by) VALUES ('rev:c', 'claim:test-1', 2, 'x', '00000000-0000-0000-0000-00000000000c')$q$);
-- §3.3: a role cannot be claimed by the caller.
SELECT t.expect_error('contributor grants self editor', $q$INSERT INTO public.role_grants (user_id, role, granted_by) VALUES ('00000000-0000-0000-0000-00000000000c', 'research_editor', '00000000-0000-0000-0000-00000000000a')$q$);
RESET ROLE;

-- §3.2: an editor cannot approve their own revision or proposal.
SET ROLE authenticated; SELECT t.act_as(:editor_a);
INSERT INTO public.claim_revisions (id, claim_id, version, base_revision_id, statement, created_by)
  VALUES ('rev:test-1-v2', 'claim:test-1', 2, 'rev:test-1-v1', 'Revised statement', :editor_a);
UPDATE public.claim_revisions SET state = 'editorial_review' WHERE id = 'rev:test-1-v2';
SELECT t.expect_error('editor approves own revision', $q$UPDATE public.claim_revisions SET state = 'editor_approved' WHERE id = 'rev:test-1-v2'$q$);
SELECT t.expect_error('illegal transition review -> published', $q$UPDATE public.claim_revisions SET state = 'published' WHERE id = 'rev:test-1-v2'$q$);
INSERT INTO public.challenge_proposals (id, claim_id, base_revision_id, proposed_by, payload)
  VALUES ('22222222-2222-2222-2222-222222222222', 'claim:test-1', 'rev:test-1-v1', :editor_a, '{}');
SELECT t.expect_rows('editor cannot decide own proposal', $q$UPDATE public.challenge_proposals SET status = 'approved', decided_by = '00000000-0000-0000-0000-00000000000a', decided_at = now() WHERE id = '22222222-2222-2222-2222-222222222222'$q$, 0);
-- §3.4: rejection by another editor; the published revision is untouched.
SELECT t.expect_rows('editor rejects contributor proposal', $q$UPDATE public.challenge_proposals SET status = 'rejected', decided_by = '00000000-0000-0000-0000-00000000000a', decided_at = now(), decision_reason = 'not supported' WHERE id = '11111111-1111-1111-1111-111111111111'$q$, 1);
SELECT t.expect_rows('rejected proposal cannot be re-decided', $q$UPDATE public.challenge_proposals SET status = 'approved', decided_by = '00000000-0000-0000-0000-00000000000a', decided_at = now() WHERE id = '11111111-1111-1111-1111-111111111111'$q$, 0);
-- Published content is immutable even for editors.
SELECT t.expect_error('change published content via column grant', $q$UPDATE public.claim_revisions SET statement = 'tampered' WHERE id = 'rev:test-1-v1'$q$);
SELECT t.expect_error('delete revision', $q$DELETE FROM public.claim_revisions WHERE id = 'rev:test-1-v1'$q$);
SELECT t.expect_error('add evidence to a published revision', $q$INSERT INTO public.evidence_items (id, revision_id, relationship, description) VALUES ('ev:x', 'rev:test-1-v1', 'SUPPORTS', 'x')$q$);
RESET ROLE;

-- §3.6: approval by a different editor is recorded as an attributable event.
SET ROLE authenticated; SELECT t.act_as(:editor_b);
UPDATE public.claim_revisions SET state = 'editor_approved' WHERE id = 'rev:test-1-v2';
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.publication_events
                 WHERE revision_id = 'rev:test-1-v2' AND state_to = 'editor_approved'
                   AND actor_id = '00000000-0000-0000-0000-00000000000b') THEN
    RAISE EXCEPTION 'FAIL approval event missing or unattributed';
  END IF;
  RAISE NOTICE 'PASS approval recorded with actor';
END $$;

-- History is append-only, for the service role too.
SET ROLE service_role;
INSERT INTO public.audit_events (action, entity_type, entity_id) VALUES ('test', 'CLAIM', 'claim:test-1');
SELECT t.expect_error('service updates audit event', $q$UPDATE public.audit_events SET action = 'x'$q$);
SELECT t.expect_error('service edits published statement', $q$UPDATE public.claim_revisions SET statement = 'tampered' WHERE id = 'rev:test-1-v1'$q$);
SELECT t.expect_error('service deletes publication event', $q$DELETE FROM public.publication_events$q$);
INSERT INTO public.evidence_audit (id, entity_type, entity_id, change_type, reason, data) VALUES ('a1', 'CLAIM', 'c', 'CREATED', 'r', '{}');
SELECT t.expect_error('service updates legacy audit', $q$UPDATE public.evidence_audit SET reason = 'x'$q$);
-- Legacy proposals: no self-decision, and decisions are final.
INSERT INTO public.evidence_challenge_proposals (id, claim_id, analysis_id, base_version, proposed_by, proposer_role, data)
  VALUES ('p1', 'c', 'analysis-test', '2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-00000000000c', 'research_contributor', '{}');
SELECT t.expect_error('legacy self-decision', $q$UPDATE public.evidence_challenge_proposals SET status = 'approved', decided_by = '00000000-0000-0000-0000-00000000000c', decided_at = now() WHERE id = 'p1'$q$);
UPDATE public.evidence_challenge_proposals SET status = 'rejected', decided_by = :editor_a, decided_at = now() WHERE id = 'p1';
SELECT t.expect_error('legacy re-decision', $q$UPDATE public.evidence_challenge_proposals SET status = 'approved', decided_by = '00000000-0000-0000-0000-00000000000a' WHERE id = 'p1'$q$);
-- §3.5 (single database): conditional update on the analysis version.
SELECT t.expect_rows('stale version updates nothing', $q$UPDATE public.evidence_analyses SET title = 'x' WHERE id = 'analysis-test' AND data->>'updatedAt' = '1999-01-01T00:00:00.000Z'$q$, 0);
RESET ROLE;

-- Reviewers attest only for themselves.
SET ROLE authenticated; SELECT t.act_as(:editor_a);
SELECT t.expect_error('forged attestation', $q$INSERT INTO public.reviewer_attestations (assignment_id, reviewer_id, decision, scope, findings, conflict_of_interest) VALUES (gen_random_uuid(), '00000000-0000-0000-0000-00000000000b', 'endorse', 's', 'f', 'none')$q$);
RESET ROLE;

\echo 'ALL RLS TESTS PASSED'
