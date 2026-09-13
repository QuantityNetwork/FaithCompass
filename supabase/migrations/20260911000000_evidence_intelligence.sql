-- Evidence Intelligence storage.
--
-- Analyses are stored whole, as JSONB, rather than normalised across a table
-- per entity. A claim only means anything alongside its evidence ledger and the
-- sources that ledger cites: they are produced together, they are re-scored
-- together when an assessment is challenged, and a half-updated analysis would
-- be an analysis that misrepresents its own evidence. Storing the aggregate
-- makes that atomic for free.
--
-- The columns lifted out of the JSONB are the ones we query on or report over
-- (slug, claim ids, model and prompt versions). Everything else stays in `data`
-- and is validated by the Zod schemas in src/lib/evidence/schema.ts before it
-- is written, so the database is not the only thing standing between a
-- malformed analysis and a reader.
--
-- Idempotent, so it can be applied to whichever Supabase project the app is
-- pointed at without coordinating with an existing migration chain.

CREATE TABLE IF NOT EXISTS public.evidence_analyses (
  -- TEXT, not UUID: curated demonstrations carry stable readable ids
  -- ("analysis-daniel-12-1") so a seed re-run upserts rather than duplicating.
  id TEXT NOT NULL PRIMARY KEY,
  resource_id TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  slug TEXT,
  title TEXT NOT NULL,
  analysis_version TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  model_provider TEXT NOT NULL,
  model_version TEXT NOT NULL,
  seeded BOOLEAN NOT NULL DEFAULT false,
  -- Denormalised so a claim can be resolved to its analysis in one indexed
  -- lookup instead of scanning every analysis document.
  claim_ids TEXT[] NOT NULL DEFAULT '{}',
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS evidence_analyses_slug_idx ON public.evidence_analyses (slug);
CREATE INDEX IF NOT EXISTS evidence_analyses_resource_idx ON public.evidence_analyses (resource_id);
CREATE INDEX IF NOT EXISTS evidence_analyses_claim_ids_idx ON public.evidence_analyses USING GIN (claim_ids);

CREATE TABLE IF NOT EXISTS public.evidence_challenges (
  id TEXT NOT NULL PRIMARY KEY,
  claim_id TEXT NOT NULL,
  analysis_id TEXT NOT NULL REFERENCES public.evidence_analyses(id) ON DELETE CASCADE,
  -- Kept as columns as well as in `data`: the whole point of a challenge is
  -- that the previous assessment stays legible after it is superseded.
  previous_score INTEGER,
  revised_score INTEGER,
  outcome TEXT NOT NULL,
  model_provider TEXT NOT NULL,
  model_version TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS evidence_challenges_claim_idx ON public.evidence_challenges (claim_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.evidence_audit (
  id TEXT NOT NULL PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  change_type TEXT NOT NULL,
  reason TEXT NOT NULL,
  -- An assessment that changes months later is only explainable if we recorded
  -- which model and which prompt produced each version of it.
  model_provider TEXT,
  model_version TEXT,
  prompt_version TEXT,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS evidence_audit_entity_idx ON public.evidence_audit (entity_id, created_at DESC);

-- Access.
--
-- Evidence analyses are published research output: anyone may read them, which
-- is what makes an assessment checkable. Writes are service_role only — the app
-- writes server-side with the service key, never from the browser. No policy
-- grants INSERT or UPDATE to anon or authenticated, so a reader cannot alter an
-- assessment or its audit trail.

ALTER TABLE public.evidence_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_audit ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.evidence_analyses TO anon, authenticated;
GRANT SELECT ON public.evidence_challenges TO anon, authenticated;
GRANT SELECT ON public.evidence_audit TO anon, authenticated;

GRANT ALL ON public.evidence_analyses TO service_role;
GRANT ALL ON public.evidence_challenges TO service_role;
GRANT ALL ON public.evidence_audit TO service_role;

DROP POLICY IF EXISTS "Evidence analyses are publicly readable" ON public.evidence_analyses;
CREATE POLICY "Evidence analyses are publicly readable"
  ON public.evidence_analyses FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Assessment challenges are publicly readable" ON public.evidence_challenges;
CREATE POLICY "Assessment challenges are publicly readable"
  ON public.evidence_challenges FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Audit records are publicly readable" ON public.evidence_audit;
CREATE POLICY "Audit records are publicly readable"
  ON public.evidence_audit FOR SELECT TO anon, authenticated USING (true);
