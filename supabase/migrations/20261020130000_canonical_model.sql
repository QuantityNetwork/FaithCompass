-- Canonical scholarly model (Master Prompt 3, §4). Stage 2 preparation.
--
-- NOT applied to any database. Reviewed and tested only against a local,
-- throwaway PostgreSQL 17 with a stub of the Supabase `auth` schema
-- (supabase/tests/). Apply to Supabase only after the owner connects a project
-- (docs/RELEASE_BLOCKERS.md B1) and the ID mapping in docs/ID_MAPPING.md has
-- been reviewed.
--
-- Principles
--  * One canonical id per real-world thing; ids are stable text ("work:...",
--    "claim:...") so URLs, REST, MCP and exports keep working. Distinct works and
--    editions are never merged: an edition belongs to exactly one work.
--  * Published history is append-only. Claim content lives in claim_revisions,
--    whose content columns never change; a claim points at its current revision.
--  * Visitors never write canonical tables. Contributors write proposals and
--    drafts as themselves; editors decide others' proposals; a reviewer attests
--    only in their own name, on an assignment made by an editorial admin.
--  * Roles come from role_grants (managed by admins), never from anything the
--    client controls. No row in this file grants any user a role.

BEGIN;

-- --------------------------------------------------------------- types
DO $$ BEGIN
  CREATE TYPE public.am_role AS ENUM (
    'public_reader', 'research_contributor', 'research_editor',
    'scholarly_reviewer', 'editorial_admin', 'system_admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.am_workflow_state AS ENUM (
    'draft', 'source_validated', 'editorial_review', 'editor_approved',
    'external_review_pending', 'externally_reviewed', 'published',
    'suspended', 'withdrawn', 'superseded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.am_proposal_status AS ENUM ('proposed', 'approved', 'rejected', 'superseded', 'withdrawn');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Seven citation levels (§5); 0 = not checked.
DO $$ BEGIN
  CREATE TYPE public.am_verification_level AS ENUM (
    'unchecked', 'syntax', 'in_registry', 'bibliographic_external', 'edition_identified',
    'passage_exists', 'quote_matches', 'bears_on_claim');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- --------------------------------------------------------------- roles
CREATE TABLE IF NOT EXISTS public.role_grants (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL,
  role public.am_role NOT NULL,
  granted_by UUID NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  note TEXT,
  CONSTRAINT role_grant_not_self CHECK (granted_by <> user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS role_grants_active_idx ON public.role_grants (user_id, role) WHERE revoked_at IS NULL;

-- SECURITY DEFINER so policies can consult grants without exposing the table.
CREATE OR REPLACE FUNCTION public.am_has_role(wanted public.am_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.role_grants g
    WHERE g.user_id = auth.uid() AND g.revoked_at IS NULL AND g.role = ANY (wanted));
$$;
REVOKE ALL ON FUNCTION public.am_has_role(public.am_role[]) FROM public;
GRANT EXECUTE ON FUNCTION public.am_has_role(public.am_role[]) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.am_is_editor() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT public.am_has_role(ARRAY['research_editor', 'editorial_admin']::public.am_role[]);
$$;

-- --------------------------------------------------------------- append-only helper
CREATE OR REPLACE FUNCTION public.am_refuse_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END $$;

-- --------------------------------------------------------------- corpus & sources
CREATE TABLE IF NOT EXISTS public.corpus_versions (
  id TEXT PRIMARY KEY,                       -- e.g. record_version hash "f79c70d2ef22dde1"
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS public.traditions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.works (
  id TEXT PRIMARY KEY CHECK (id ~ '^work:[a-z0-9][a-z0-9._-]*$'),
  title TEXT NOT NULL,
  author TEXT,
  work_type TEXT NOT NULL,                   -- scripture, commentary, monograph, article, catalogue...
  tradition_id TEXT REFERENCES public.traditions(id),
  original_language TEXT,
  date_text TEXT,                            -- as stated; no false precision
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.editions (
  id TEXT PRIMARY KEY CHECK (id ~ '^ed:[a-z0-9][a-z0-9._-]*$'),
  work_id TEXT NOT NULL REFERENCES public.works(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  editor TEXT,
  translator TEXT,
  publisher TEXT,
  year INTEGER CHECK (year BETWEEN -3000 AND 2100),
  language TEXT,
  isbn TEXT,
  doi TEXT,
  oclc TEXT,
  other_identifiers JSONB NOT NULL DEFAULT '{}'::jsonb,
  permitted_use TEXT,
  verification_level public.am_verification_level NOT NULL DEFAULT 'unchecked',
  verification_report JSONB,                  -- method, outcome, checked_at, checked_by, external source
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.manuscript_witnesses (
  id TEXT PRIMARY KEY CHECK (id ~ '^ms:[a-z0-9][a-z0-9._-]*$'),
  work_id TEXT NOT NULL REFERENCES public.works(id) ON DELETE RESTRICT,
  siglum TEXT,
  repository TEXT,
  shelfmark TEXT,
  catalogue_ref TEXT,
  date_text TEXT,
  language TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS public.passages (
  id TEXT PRIMARY KEY CHECK (id ~ '^psg:[a-z0-9][a-z0-9._:-]*$'),
  work_id TEXT NOT NULL REFERENCES public.works(id) ON DELETE RESTRICT,
  edition_id TEXT REFERENCES public.editions(id),
  witness_id TEXT REFERENCES public.manuscript_witnesses(id),
  reference TEXT NOT NULL,                   -- "Daniel 12:1"
  anchor TEXT NOT NULL,                      -- normalised coordinates "dan.12.1"
  excerpt TEXT,
  translation_attribution TEXT,
  verification_level public.am_verification_level NOT NULL DEFAULT 'unchecked',
  verification_report JSONB
);
CREATE UNIQUE INDEX IF NOT EXISTS passages_anchor_idx
  ON public.passages (work_id, anchor, COALESCE(edition_id, ''), COALESCE(witness_id, ''));

-- --------------------------------------------------------------- claims & revisions
CREATE TABLE IF NOT EXISTS public.claims (
  id TEXT PRIMARY KEY CHECK (id ~ '^claim:[A-Za-z0-9][A-Za-z0-9._-]*$'),
  claim_type TEXT NOT NULL,
  current_revision_id TEXT,                  -- FK added below (circular)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.claim_revisions (
  id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL REFERENCES public.claims(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL CHECK (version >= 1),
  base_revision_id TEXT REFERENCES public.claim_revisions(id),
  statement TEXT NOT NULL,
  -- Qualitative assessment by default (§7); numeric fields only with rationale.
  assessment JSONB NOT NULL DEFAULT '{}'::jsonb,
  corpus_version_id TEXT REFERENCES public.corpus_versions(id),
  state public.am_workflow_state NOT NULL DEFAULT 'draft',
  contested BOOLEAN NOT NULL DEFAULT false,
  insufficient_evidence BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  state_changed_by UUID,
  state_changed_at TIMESTAMPTZ,
  UNIQUE (claim_id, version)
);

DO $$ BEGIN
  ALTER TABLE public.claims ADD CONSTRAINT claims_current_revision_fk
    FOREIGN KEY (current_revision_id) REFERENCES public.claim_revisions(id) DEFERRABLE INITIALLY DEFERRED;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Revision content is immutable; only the workflow state moves, along allowed
-- edges, and never to approval by the revision's own author.
-- SECURITY DEFINER so it can write publication_events, which no client role may.
CREATE OR REPLACE FUNCTION public.am_claim_revision_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  allowed boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'claim revisions cannot be deleted; withdraw or supersede instead';
  END IF;
  IF (NEW.id, NEW.claim_id, NEW.version, NEW.base_revision_id, NEW.statement, NEW.assessment,
      NEW.corpus_version_id, NEW.created_by, NEW.created_at)
     IS DISTINCT FROM
     (OLD.id, OLD.claim_id, OLD.version, OLD.base_revision_id, OLD.statement, OLD.assessment,
      OLD.corpus_version_id, OLD.created_by, OLD.created_at) THEN
    RAISE EXCEPTION 'claim revision content is immutable; create a new revision';
  END IF;
  IF NEW.state <> OLD.state THEN
    allowed := (OLD.state, NEW.state) IN (
      ('draft', 'source_validated'), ('draft', 'editorial_review'), ('draft', 'withdrawn'),
      ('source_validated', 'editorial_review'), ('source_validated', 'withdrawn'),
      ('editorial_review', 'editor_approved'), ('editorial_review', 'draft'), ('editorial_review', 'withdrawn'),
      ('editor_approved', 'external_review_pending'), ('editor_approved', 'published'),
      ('external_review_pending', 'externally_reviewed'), ('external_review_pending', 'editorial_review'),
      ('externally_reviewed', 'published'),
      ('published', 'suspended'), ('published', 'withdrawn'), ('published', 'superseded'),
      ('suspended', 'published'), ('suspended', 'withdrawn'));
    IF NOT allowed THEN
      RAISE EXCEPTION 'illegal workflow transition % -> %', OLD.state, NEW.state;
    END IF;
    IF NEW.state = 'editor_approved' AND OLD.created_by IS NOT NULL AND auth.uid() = OLD.created_by THEN
      RAISE EXCEPTION 'a revision cannot be approved by its author';
    END IF;
    IF NEW.state = 'externally_reviewed' AND NOT EXISTS (
      SELECT 1 FROM public.reviewer_attestations a WHERE a.revision_id = NEW.id) THEN
      RAISE EXCEPTION 'externally_reviewed requires a reviewer attestation';
    END IF;
    NEW.state_changed_by := auth.uid();
    NEW.state_changed_at := now();
    INSERT INTO public.publication_events (revision_id, state_from, state_to, actor_id)
      VALUES (NEW.id, OLD.state, NEW.state, auth.uid());
  END IF;
  RETURN NEW;
END $$;

-- --------------------------------------------------------------- evidence & argument
CREATE TABLE IF NOT EXISTS public.evidence_items (
  id TEXT PRIMARY KEY,
  revision_id TEXT NOT NULL REFERENCES public.claim_revisions(id) ON DELETE RESTRICT,
  passage_id TEXT REFERENCES public.passages(id),
  edition_id TEXT REFERENCES public.editions(id),
  relationship TEXT NOT NULL CHECK (relationship IN
    ('SUPPORTS', 'WEAKLY_SUPPORTS', 'NEUTRAL', 'WEAKLY_CHALLENGES', 'CHALLENGES', 'CONTRADICTS')),
  dimension TEXT,
  quality_tier TEXT,
  directness NUMERIC CHECK (directness BETWEEN 0 AND 1),
  relevance NUMERIC CHECK (relevance BETWEEN 0 AND 1),
  independence NUMERIC CHECK (independence BETWEEN 0 AND 1),
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.assumptions (
  id TEXT PRIMARY KEY,
  revision_id TEXT NOT NULL REFERENCES public.claim_revisions(id) ON DELETE RESTRICT,
  kind TEXT,                                 -- historical, theological, methodological...
  text TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.arguments (
  id TEXT PRIMARY KEY,
  revision_id TEXT NOT NULL REFERENCES public.claim_revisions(id) ON DELETE RESTRICT,
  kind TEXT NOT NULL,                        -- deductive, abductive, cumulative...
  conclusion TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.premises (
  id TEXT PRIMARY KEY,
  argument_id TEXT NOT NULL REFERENCES public.arguments(id) ON DELETE RESTRICT,
  position INTEGER NOT NULL,
  text TEXT NOT NULL,
  assumption_id TEXT REFERENCES public.assumptions(id),
  evidence_item_id TEXT REFERENCES public.evidence_items(id),
  UNIQUE (argument_id, position)
);

CREATE TABLE IF NOT EXISTS public.tradition_positions (
  id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL REFERENCES public.claims(id) ON DELETE RESTRICT,
  tradition_id TEXT NOT NULL REFERENCES public.traditions(id),
  position TEXT NOT NULL CHECK (position IN ('affirms', 'denies', 'qualifies', 'no_position')),
  summary TEXT NOT NULL,
  source_passage_id TEXT REFERENCES public.passages(id),
  UNIQUE (claim_id, tradition_id)
);

CREATE TABLE IF NOT EXISTS public.contradictions (
  id TEXT PRIMARY KEY,
  claim_a TEXT NOT NULL REFERENCES public.claims(id),
  claim_b TEXT NOT NULL REFERENCES public.claims(id),
  kind TEXT NOT NULL,                        -- logical, historical, textual
  note TEXT,
  CHECK (claim_a < claim_b)                  -- one row per pair
);

-- --------------------------------------------------------------- dossiers
CREATE TABLE IF NOT EXISTS public.dossiers (
  id TEXT PRIMARY KEY CHECK (id ~ '^dossier:[a-z0-9][a-z0-9._-]*$'),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  scope TEXT NOT NULL,
  state public.am_workflow_state NOT NULL DEFAULT 'draft',
  corpus_version_id TEXT REFERENCES public.corpus_versions(id),
  manifest JSONB,                            -- reproducibility manifest
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.dossier_claims (
  dossier_id TEXT NOT NULL REFERENCES public.dossiers(id) ON DELETE RESTRICT,
  claim_id TEXT NOT NULL REFERENCES public.claims(id) ON DELETE RESTRICT,
  position INTEGER NOT NULL,
  PRIMARY KEY (dossier_id, claim_id)
);

-- --------------------------------------------------------------- research activity (class B)
CREATE TABLE IF NOT EXISTS public.analysis_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID,                           -- null when made server-side for an anonymous visitor
  question_hash TEXT NOT NULL,               -- the question itself is in `result`, never in logs
  provider TEXT NOT NULL,
  model_version TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  corpus_version_id TEXT REFERENCES public.corpus_versions(id),
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'refused')),
  result JSONB,
  is_draft BOOLEAN NOT NULL DEFAULT true CHECK (is_draft),  -- never published by being run
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.challenge_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id TEXT NOT NULL REFERENCES public.claims(id) ON DELETE RESTRICT,
  base_revision_id TEXT NOT NULL REFERENCES public.claim_revisions(id),
  proposed_by UUID,
  status public.am_proposal_status NOT NULL DEFAULT 'proposed',
  payload JSONB NOT NULL,
  idempotency_key TEXT UNIQUE,
  decided_by UUID,
  decided_at TIMESTAMPTZ,
  decision_reason TEXT,
  resulting_revision_id TEXT REFERENCES public.claim_revisions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT challenge_not_self_decided CHECK (decided_by IS NULL OR proposed_by IS NULL OR decided_by <> proposed_by)
);

-- --------------------------------------------------------------- review (class C)
CREATE TABLE IF NOT EXISTS public.reviewers (
  user_id UUID PRIMARY KEY,                  -- the reviewer's own Supabase Auth account
  display_name TEXT NOT NULL,
  affiliation TEXT,
  expertise TEXT[] NOT NULL DEFAULT '{}',
  conflict_of_interest TEXT,
  verified_by UUID,                          -- editorial admin who checked identity and expertise
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (verified_by IS NULL OR verified_by <> user_id)
);

CREATE TABLE IF NOT EXISTS public.review_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_id TEXT REFERENCES public.claim_revisions(id),
  dossier_id TEXT REFERENCES public.dossiers(id),
  reviewer_id UUID NOT NULL REFERENCES public.reviewers(user_id),
  assigned_by UUID NOT NULL,
  scope TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'completed', 'declined', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((revision_id IS NULL) <> (dossier_id IS NULL)),
  CHECK (assigned_by <> reviewer_id)
);

CREATE TABLE IF NOT EXISTS public.reviewer_attestations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.review_assignments(id),
  reviewer_id UUID NOT NULL REFERENCES public.reviewers(user_id),
  revision_id TEXT REFERENCES public.claim_revisions(id),
  dossier_id TEXT REFERENCES public.dossiers(id),
  decision TEXT NOT NULL CHECK (decision IN ('endorse', 'endorse_with_corrections', 'not_endorsed', 'outside_competence')),
  scope TEXT NOT NULL,
  findings TEXT NOT NULL,
  corrections TEXT,
  conflict_of_interest TEXT NOT NULL,        -- "none declared" must be stated, not assumed
  signed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- --------------------------------------------------------------- history, audit, mapping
CREATE TABLE IF NOT EXISTS public.publication_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  revision_id TEXT NOT NULL REFERENCES public.claim_revisions(id),
  state_from public.am_workflow_state,
  state_to public.am_workflow_state NOT NULL,
  actor_id UUID,
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id UUID,
  actor_role public.am_role,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  before JSONB,
  after JSONB,
  request_id UUID
);
CREATE INDEX IF NOT EXISTS audit_events_entity_idx ON public.audit_events (entity_type, entity_id, at DESC);

-- How identifiers from the current record (src/data/*), the Evidence
-- Intelligence registry (src/lib/evidence/corpus) and the EI analyses map onto
-- canonical ids. One legacy id maps to exactly one canonical id; several legacy
-- ids may map to one canonical id only when they are the same work or edition.
CREATE TABLE IF NOT EXISTS public.id_mappings (
  legacy_system TEXT NOT NULL CHECK (legacy_system IN ('record', 'ei_registry', 'ei_analysis', 'ledger')),
  legacy_id TEXT NOT NULL,
  canonical_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  rationale TEXT NOT NULL,
  mapped_by UUID,
  mapped_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (legacy_system, legacy_id)
);

-- --------------------------------------------------------------- triggers
DROP TRIGGER IF EXISTS claim_revisions_guard ON public.claim_revisions;
CREATE TRIGGER claim_revisions_guard BEFORE UPDATE OR DELETE ON public.claim_revisions
  FOR EACH ROW EXECUTE FUNCTION public.am_claim_revision_guard();

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['publication_events', 'audit_events', 'reviewer_attestations'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %1$s_append_only ON public.%1$s', t);
    EXECUTE format('CREATE TRIGGER %1$s_append_only BEFORE UPDATE OR DELETE ON public.%1$s FOR EACH ROW EXECUTE FUNCTION public.am_refuse_mutation()', t);
  END LOOP;
END $$;

-- A published revision's evidence, argument and assumptions are frozen with it.
CREATE OR REPLACE FUNCTION public.am_revision_children_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rev text; st public.am_workflow_state;
BEGIN
  IF TG_TABLE_NAME = 'premises' THEN
    SELECT a.revision_id INTO rev FROM public.arguments a WHERE a.id = COALESCE(NEW.argument_id, OLD.argument_id);
  ELSE
    rev := COALESCE(NEW.revision_id, OLD.revision_id);
  END IF;
  SELECT state INTO st FROM public.claim_revisions WHERE id = rev;
  IF st NOT IN ('draft', 'source_validated', 'editorial_review') THEN
    RAISE EXCEPTION 'revision % is % and its contents are frozen', rev, st;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['evidence_items', 'assumptions', 'arguments', 'premises'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %1$s_frozen ON public.%1$s', t);
    EXECUTE format('CREATE TRIGGER %1$s_frozen BEFORE INSERT OR UPDATE OR DELETE ON public.%1$s FOR EACH ROW EXECUTE FUNCTION public.am_revision_children_guard()', t);
  END LOOP;
END $$;

-- --------------------------------------------------------------- row-level security
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'role_grants', 'corpus_versions', 'traditions', 'works', 'editions', 'manuscript_witnesses',
    'passages', 'claims', 'claim_revisions', 'evidence_items', 'assumptions', 'arguments', 'premises',
    'tradition_positions', 'contradictions', 'dossiers', 'dossier_claims', 'analysis_runs',
    'challenge_proposals', 'reviewers', 'review_assignments', 'reviewer_attestations',
    'publication_events', 'audit_events', 'id_mappings'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;

-- Public, registration-free reading of bibliographic data and published work.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['corpus_versions', 'traditions', 'works', 'editions', 'manuscript_witnesses',
                           'passages', 'claims', 'tradition_positions', 'contradictions'] LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO anon, authenticated', t);
    EXECUTE format('DROP POLICY IF EXISTS public_read ON public.%I', t);
    EXECUTE format('CREATE POLICY public_read ON public.%I FOR SELECT TO anon, authenticated USING (true)', t);
  END LOOP;
END $$;

-- A revision is public once published, and stays citable after it is superseded or withdrawn.
GRANT SELECT ON public.claim_revisions TO anon, authenticated;
DROP POLICY IF EXISTS revisions_read ON public.claim_revisions;
CREATE POLICY revisions_read ON public.claim_revisions FOR SELECT TO anon, authenticated
  USING (state IN ('published', 'superseded', 'withdrawn', 'suspended')
         OR created_by = auth.uid() OR public.am_is_editor());

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['evidence_items', 'assumptions', 'arguments'] LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO anon, authenticated', t);
    EXECUTE format('DROP POLICY IF EXISTS follows_revision ON public.%I', t);
    EXECUTE format($p$CREATE POLICY follows_revision ON public.%I FOR SELECT TO anon, authenticated
      USING (EXISTS (SELECT 1 FROM public.claim_revisions r WHERE r.id = revision_id))$p$, t);
  END LOOP;
END $$;
GRANT SELECT ON public.premises TO anon, authenticated;
DROP POLICY IF EXISTS follows_argument ON public.premises;
CREATE POLICY follows_argument ON public.premises FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.arguments a WHERE a.id = argument_id));

GRANT SELECT ON public.dossiers, public.dossier_claims TO anon, authenticated;
DROP POLICY IF EXISTS dossiers_read ON public.dossiers;
CREATE POLICY dossiers_read ON public.dossiers FOR SELECT TO anon, authenticated
  USING (state IN ('published', 'superseded', 'withdrawn', 'suspended') OR public.am_is_editor());
DROP POLICY IF EXISTS dossier_claims_read ON public.dossier_claims;
CREATE POLICY dossier_claims_read ON public.dossier_claims FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.dossiers d WHERE d.id = dossier_id));

GRANT SELECT ON public.publication_events TO anon, authenticated;
DROP POLICY IF EXISTS publication_events_read ON public.publication_events;
CREATE POLICY publication_events_read ON public.publication_events FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.claim_revisions r WHERE r.id = revision_id));

-- Verified reviewers are public (a review must have a name); unverified ones are not.
GRANT SELECT ON public.reviewers TO anon, authenticated;
DROP POLICY IF EXISTS reviewers_read ON public.reviewers;
CREATE POLICY reviewers_read ON public.reviewers FOR SELECT TO anon, authenticated
  USING (verified_at IS NOT NULL OR user_id = auth.uid() OR public.am_is_editor());
GRANT SELECT ON public.reviewer_attestations TO anon, authenticated;
DROP POLICY IF EXISTS attestations_read ON public.reviewer_attestations;
CREATE POLICY attestations_read ON public.reviewer_attestations FOR SELECT TO anon, authenticated
  USING (revision_id IS NULL OR EXISTS (SELECT 1 FROM public.claim_revisions r WHERE r.id = revision_id));

-- Editors write canonical content (drafts and state changes; the triggers
-- enforce immutability and the workflow graph).
GRANT INSERT ON public.claim_revisions, public.evidence_items, public.assumptions, public.arguments, public.premises TO authenticated;
GRANT UPDATE (state, contested, insufficient_evidence) ON public.claim_revisions TO authenticated;
DROP POLICY IF EXISTS revisions_insert ON public.claim_revisions;
CREATE POLICY revisions_insert ON public.claim_revisions FOR INSERT TO authenticated
  WITH CHECK (public.am_is_editor() AND created_by = auth.uid() AND state = 'draft');
DROP POLICY IF EXISTS revisions_state ON public.claim_revisions;
CREATE POLICY revisions_state ON public.claim_revisions FOR UPDATE TO authenticated
  USING (public.am_is_editor()) WITH CHECK (public.am_is_editor());
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['evidence_items', 'assumptions', 'arguments', 'premises'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS editor_insert ON public.%I', t);
    EXECUTE format('CREATE POLICY editor_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (public.am_is_editor())', t);
  END LOOP;
END $$;

-- Contributors: their own drafts and proposals, as themselves.
GRANT SELECT, INSERT ON public.analysis_runs TO authenticated;
DROP POLICY IF EXISTS runs_own_read ON public.analysis_runs;
CREATE POLICY runs_own_read ON public.analysis_runs FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.am_is_editor());
DROP POLICY IF EXISTS runs_own_insert ON public.analysis_runs;
CREATE POLICY runs_own_insert ON public.analysis_runs FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

GRANT SELECT, INSERT ON public.challenge_proposals TO authenticated;
GRANT UPDATE (status, decided_by, decided_at, decision_reason, resulting_revision_id) ON public.challenge_proposals TO authenticated;
DROP POLICY IF EXISTS proposals_read ON public.challenge_proposals;
CREATE POLICY proposals_read ON public.challenge_proposals FOR SELECT TO authenticated
  USING (proposed_by = auth.uid() OR public.am_is_editor());
DROP POLICY IF EXISTS proposals_insert ON public.challenge_proposals;
CREATE POLICY proposals_insert ON public.challenge_proposals FOR INSERT TO authenticated
  WITH CHECK (proposed_by = auth.uid() AND status = 'proposed' AND decided_by IS NULL AND decided_at IS NULL);
DROP POLICY IF EXISTS proposals_decide ON public.challenge_proposals;
CREATE POLICY proposals_decide ON public.challenge_proposals FOR UPDATE TO authenticated
  USING (public.am_is_editor() AND status = 'proposed' AND proposed_by IS DISTINCT FROM auth.uid())
  WITH CHECK (decided_by = auth.uid() AND status IN ('approved', 'rejected', 'superseded'));

-- Reviewers attest only for themselves, on an open assignment that is theirs.
GRANT INSERT ON public.reviewer_attestations TO authenticated;
DROP POLICY IF EXISTS attest_own ON public.reviewer_attestations;
CREATE POLICY attest_own ON public.reviewer_attestations FOR INSERT TO authenticated
  WITH CHECK (
    reviewer_id = auth.uid()
    AND public.am_has_role(ARRAY['scholarly_reviewer']::public.am_role[])
    AND EXISTS (SELECT 1 FROM public.reviewers rv WHERE rv.user_id = auth.uid() AND rv.verified_at IS NOT NULL)
    AND EXISTS (SELECT 1 FROM public.review_assignments a
                WHERE a.id = assignment_id AND a.reviewer_id = auth.uid() AND a.status = 'open'));
GRANT SELECT ON public.review_assignments TO authenticated;
DROP POLICY IF EXISTS assignments_read ON public.review_assignments;
CREATE POLICY assignments_read ON public.review_assignments FOR SELECT TO authenticated
  USING (reviewer_id = auth.uid() OR public.am_is_editor());

-- Roles and audit: visible to the user concerned and to admins; written only by
-- the service (role grants via an admin tool in Stage 5, audit by the server).
GRANT SELECT ON public.role_grants, public.audit_events TO authenticated;
DROP POLICY IF EXISTS grants_read ON public.role_grants;
CREATE POLICY grants_read ON public.role_grants FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.am_has_role(ARRAY['editorial_admin', 'system_admin']::public.am_role[]));
DROP POLICY IF EXISTS audit_read ON public.audit_events;
CREATE POLICY audit_read ON public.audit_events FOR SELECT TO authenticated
  USING (public.am_has_role(ARRAY['editorial_admin', 'system_admin', 'research_editor']::public.am_role[]));

COMMIT;
