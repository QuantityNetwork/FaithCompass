-- Editorial workflow for the Evidence Intelligence store (Stage 1, P0 fix).
--
-- Visitor work is kept apart from the published record:
--   evidence_challenge_proposals  challenges awaiting an editor's decision
--   evidence_analysis_drafts      provisional analyses generated on request
-- Neither is publicly readable. The published analyses change only when an
-- editor who did not write a proposal approves it (src/lib/evidence/revisions.ts),
-- through a conditional update on the analysis version.
--
-- Also makes the audit trail append-only and stops publishing audit rows about
-- drafts and proposals (those can identify who asked what).
--
-- Idempotent. NOT applied to any database yet: see docs/RELEASE_BLOCKERS.md.

CREATE TABLE IF NOT EXISTS public.evidence_challenge_proposals (
  id TEXT NOT NULL PRIMARY KEY,
  claim_id TEXT NOT NULL,
  analysis_id TEXT NOT NULL REFERENCES public.evidence_analyses(id) ON DELETE RESTRICT,
  -- The analysis version (data->>'updatedAt') the proposal was computed against.
  base_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed', 'approved', 'rejected', 'superseded')),
  proposed_by UUID,
  proposer_role TEXT NOT NULL,
  idempotency_key TEXT UNIQUE CHECK (idempotency_key ~ '^[A-Za-z0-9_-]{8,128}$'),
  decided_by UUID,
  decided_role TEXT,
  decided_at TIMESTAMP WITH TIME ZONE,
  decision_reason TEXT CHECK (decision_reason IS NULL OR length(decision_reason) <= 2000),
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- No self-approval, enforced by the database as well as the application.
  CONSTRAINT proposal_not_self_decided CHECK (decided_by IS NULL OR proposed_by IS NULL OR decided_by <> proposed_by),
  CONSTRAINT proposal_decision_complete CHECK (
    (status = 'proposed' AND decided_by IS NULL AND decided_at IS NULL)
    OR (status <> 'proposed' AND decided_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS evidence_challenge_proposals_claim_idx
  ON public.evidence_challenge_proposals (claim_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.evidence_analysis_drafts (
  id TEXT NOT NULL PRIMARY KEY,
  created_by UUID,
  creator_role TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- A decided proposal is final: only 'proposed' -> anything, and 'approved' ->
-- 'superseded' (when applying the decision lost a version race).
CREATE OR REPLACE FUNCTION public.evidence_proposal_transition_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id <> OLD.id OR NEW.claim_id <> OLD.claim_id OR NEW.analysis_id <> OLD.analysis_id
     OR NEW.base_version <> OLD.base_version OR NEW.data <> OLD.data
     OR NEW.proposed_by IS DISTINCT FROM OLD.proposed_by OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'proposal content is immutable';
  END IF;
  IF NOT (OLD.status = 'proposed' OR (OLD.status = 'approved' AND NEW.status = 'superseded')) THEN
    RAISE EXCEPTION 'proposal % is already %', OLD.id, OLD.status;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS evidence_proposal_transition_guard ON public.evidence_challenge_proposals;
CREATE TRIGGER evidence_proposal_transition_guard
  BEFORE UPDATE ON public.evidence_challenge_proposals
  FOR EACH ROW EXECUTE FUNCTION public.evidence_proposal_transition_guard();

-- Append-only audit and challenge history, for every role including service_role.
CREATE OR REPLACE FUNCTION public.am_refuse_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END $$;

DROP TRIGGER IF EXISTS evidence_audit_append_only ON public.evidence_audit;
CREATE TRIGGER evidence_audit_append_only
  BEFORE UPDATE OR DELETE ON public.evidence_audit
  FOR EACH ROW EXECUTE FUNCTION public.am_refuse_mutation();

DROP TRIGGER IF EXISTS evidence_challenges_append_only ON public.evidence_challenges;
CREATE TRIGGER evidence_challenges_append_only
  BEFORE UPDATE OR DELETE ON public.evidence_challenges
  FOR EACH ROW EXECUTE FUNCTION public.am_refuse_mutation();

-- Access. Server-side writes only (service role) until Stage 2 moves visitor
-- writes to the caller's own Supabase Auth JWT under the policies in the
-- canonical-model migration.
ALTER TABLE public.evidence_challenge_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_analysis_drafts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.evidence_challenge_proposals FROM anon, authenticated;
REVOKE ALL ON public.evidence_analysis_drafts FROM anon, authenticated;
GRANT ALL ON public.evidence_challenge_proposals TO service_role;
GRANT ALL ON public.evidence_analysis_drafts TO service_role;

-- Readers keep read access to the published analyses and challenge history,
-- but not to writes on them.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.evidence_analyses, public.evidence_challenges, public.evidence_audit FROM anon, authenticated;

DROP POLICY IF EXISTS "Audit records are publicly readable" ON public.evidence_audit;
CREATE POLICY "Audit records are publicly readable"
  ON public.evidence_audit FOR SELECT TO anon, authenticated
  USING (entity_type NOT IN ('PROPOSAL', 'DRAFT'));
