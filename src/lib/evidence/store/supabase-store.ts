/**
 * Supabase-backed EvidenceStore.
 *
 * The JSON store needs a writable disk, which a serverless host does not have:
 * the bundle filesystem is read-only and /tmp is wiped between cold starts, so
 * seeding throws on the first request and every page 500s. This implementation
 * is what makes the feature deployable, and it is also what makes the audit
 * trail worth having — a challenge recorded on one instance's disk is not an
 * audit trail, it is a local file.
 *
 * Writes use the service key and therefore only ever run server-side. Reads are
 * public by RLS policy: an assessment nobody can inspect is not checkable, and
 * checkable is the entire proposition.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  AnalysisSchema,
  AssessmentChallengeSchema,
  AuditRecordSchema,
  AnalysisDraftSchema,
  ChallengeProposalSchema,
  type Analysis,
  type AnalysisDraft,
  type AssessmentChallenge,
  type AuditRecord,
  type ChallengeProposal,
  type ProposalStatus,
} from '../schema';
import type { EvidenceStore } from './types';

const ANALYSES = 'evidence_analyses';
const CHALLENGES = 'evidence_challenges';
const AUDIT = 'evidence_audit';
// Added by supabase/migrations/20261020120000_editorial_workflow.sql.
const PROPOSALS = 'evidence_challenge_proposals';
const DRAFTS = 'evidence_analysis_drafts';

export class SupabaseConfigError extends Error {
  constructor(missing: string[]) {
    super(
      `Supabase store selected but not configured. Missing: ${missing.join(', ')}. ` +
        'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, or set EVIDENCE_STORE=json for local development.',
    );
    this.name = 'SupabaseConfigError';
  }
}

function resolveConfig(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const missing: string[] = [];
  if (!url) missing.push('SUPABASE_URL');
  if (!key) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (missing.length > 0) throw new SupabaseConfigError(missing);

  return { url: url!, key: key! };
}

/** Row shapes. `data` carries the full validated entity; columns are query paths. */
interface AnalysisRow {
  id: string;
  data: unknown;
}
interface ChallengeRow {
  data: unknown;
}
interface AuditRow {
  data: unknown;
}

export class SupabaseEvidenceStore implements EvidenceStore {
  readonly durable = true;
  private readonly client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    if (client) {
      this.client = client;
      return;
    }
    const { url, key } = resolveConfig();
    this.client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  /**
   * Entities are re-validated on the way out, not just on the way in.
   * A row written by an older schema version, or edited by hand, must not be
   * rendered as though the current code had produced it.
   */
  private static parseAnalysis(row: AnalysisRow | null | undefined): Analysis | null {
    if (!row) return null;
    return AnalysisSchema.parse(row.data);
  }

  async saveAnalysis(analysis: Analysis): Promise<void> {
    const validated = AnalysisSchema.parse(analysis);

    const { error } = await this.client.from(ANALYSES).upsert(
      {
        id: validated.id,
        resource_id: validated.resourceId,
        resource_type: validated.resourceType,
        slug: validated.passageReference?.slug ?? validated.resourceId,
        title: validated.title,
        analysis_version: validated.analysisVersion,
        prompt_version: validated.promptVersion,
        model_provider: validated.modelProvider,
        model_version: validated.modelVersion,
        seeded: validated.seeded,
        claim_ids: validated.claims.map((c) => c.id),
        data: validated,
        updated_at: validated.updatedAt,
      },
      { onConflict: 'id' },
    );

    // Upsert rather than insert: seeding runs on cold start and concurrent
    // instances may seed at once. Racing writes of identical curated content
    // are harmless; duplicated rows would not be.
    if (error) throw new Error(`Failed to save analysis ${validated.id}: ${error.message}`);
  }

  async getAnalysis(id: string): Promise<Analysis | null> {
    const { data, error } = await this.client
      .from(ANALYSES)
      .select('id, data')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(`Failed to load analysis ${id}: ${error.message}`);
    return SupabaseEvidenceStore.parseAnalysis(data as AnalysisRow | null);
  }

  async getAnalysisBySlug(slug: string): Promise<Analysis | null> {
    const normalised = slug.replace(/^\/+|\/+$/g, '');
    const { data, error } = await this.client
      .from(ANALYSES)
      .select('id, data')
      .or(`slug.eq.${normalised},resource_id.eq.${normalised}`)
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(`Failed to load analysis for "${slug}": ${error.message}`);
    return SupabaseEvidenceStore.parseAnalysis(data as AnalysisRow | null);
  }

  async listAnalyses(): Promise<Analysis[]> {
    const { data, error } = await this.client
      .from(ANALYSES)
      .select('id, data')
      .order('title', { ascending: true });

    if (error) throw new Error(`Failed to list analyses: ${error.message}`);
    return (data ?? []).map((row) => AnalysisSchema.parse((row as AnalysisRow).data));
  }

  async findClaim(claimId: string): Promise<{ analysis: Analysis; claimIndex: number } | null> {
    // One indexed lookup against the denormalised claim_ids array, rather than
    // pulling every analysis back and scanning it in application code.
    const { data, error } = await this.client
      .from(ANALYSES)
      .select('id, data')
      .contains('claim_ids', [claimId])
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(`Failed to find claim ${claimId}: ${error.message}`);

    const analysis = SupabaseEvidenceStore.parseAnalysis(data as AnalysisRow | null);
    if (!analysis) return null;

    const claimIndex = analysis.claims.findIndex((c) => c.id === claimId);
    // The index column said this analysis holds the claim and the document
    // disagrees. Treating that as "not found" would hide the inconsistency.
    if (claimIndex === -1) {
      throw new Error(
        `Analysis ${analysis.id} is indexed against claim ${claimId} but does not contain it. The claim_ids column is out of step with the stored document.`,
      );
    }

    return { analysis, claimIndex };
  }

  async saveChallenge(challenge: AssessmentChallenge): Promise<void> {
    const validated = AssessmentChallengeSchema.parse(challenge);

    const { error } = await this.client.from(CHALLENGES).insert({
      id: validated.id,
      claim_id: validated.claimId,
      analysis_id: validated.analysisId,
      previous_score: validated.previousScore,
      revised_score: validated.revisedScore,
      outcome: validated.outcome,
      model_provider: validated.modelProvider,
      model_version: validated.modelVersion,
      data: validated,
      created_at: validated.createdAt,
    });

    if (error) throw new Error(`Failed to save challenge ${validated.id}: ${error.message}`);
  }

  async listChallenges(claimId: string): Promise<AssessmentChallenge[]> {
    const { data, error } = await this.client
      .from(CHALLENGES)
      .select('data')
      .eq('claim_id', claimId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to list challenges for ${claimId}: ${error.message}`);
    return (data ?? []).map((row) => AssessmentChallengeSchema.parse((row as ChallengeRow).data));
  }

  async appendAudit(record: AuditRecord): Promise<void> {
    const validated = AuditRecordSchema.parse(record);

    const { error } = await this.client.from(AUDIT).insert({
      id: validated.id,
      entity_type: validated.entityType,
      entity_id: validated.entityId,
      change_type: validated.changeType,
      reason: validated.reason,
      model_provider: validated.modelProvider,
      model_version: validated.modelVersion,
      prompt_version: validated.promptVersion,
      data: validated,
      created_at: validated.timestamp,
    });

    if (error) throw new Error(`Failed to append audit record: ${error.message}`);
  }

  async listAudit(entityId: string): Promise<AuditRecord[]> {
    const { data, error } = await this.client
      .from(AUDIT)
      .select('data')
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to list audit for ${entityId}: ${error.message}`);
    return (data ?? []).map((row) => AuditRecordSchema.parse((row as AuditRow).data));
  }

  async replaceAnalysisIfVersion(analysis: Analysis, expectedUpdatedAt: string): Promise<boolean> {
    const validated = AnalysisSchema.parse(analysis);
    // Conditional update: matches nothing if another decision moved the
    // analysis on since the proposal was made.
    const { data, error } = await this.client
      .from(ANALYSES)
      .update({
        title: validated.title,
        claim_ids: validated.claims.map((c) => c.id),
        data: validated,
        updated_at: validated.updatedAt,
      })
      .eq('id', validated.id)
      .eq('data->>updatedAt', expectedUpdatedAt)
      .select('id');
    if (error) throw new Error(`Failed to update analysis ${validated.id}: ${error.message}`);
    return (data ?? []).length === 1;
  }

  async saveProposal(proposal: ChallengeProposal): Promise<void> {
    const v = ChallengeProposalSchema.parse(proposal);
    const { error } = await this.client.from(PROPOSALS).insert({
      id: v.id,
      claim_id: v.claimId,
      analysis_id: v.analysisId,
      base_version: v.baseVersion,
      status: v.status,
      proposed_by: v.proposedBy,
      proposer_role: v.proposerRole,
      idempotency_key: v.idempotencyKey,
      decided_by: null,
      decided_role: null,
      decided_at: null,
      decision_reason: null,
      data: v,
      created_at: v.createdAt,
    });
    if (error) throw new Error(`Failed to save proposal ${v.id}: ${error.message}`);
  }

  private static parseProposal(row: { data: unknown; status: string; decided_by: string | null; decided_role: string | null; decided_at: string | null; decision_reason: string | null } | null): ChallengeProposal | null {
    if (!row) return null;
    // Status and decision live in columns (they are what the compare-and-set
    // updates); the JSONB carries the immutable proposal body.
    const base = ChallengeProposalSchema.parse(row.data);
    return ChallengeProposalSchema.parse({
      ...base,
      status: row.status,
      decidedBy: row.decided_by ?? null,
      decidedRole: row.decided_role ?? null,
      decidedAt: row.decided_at ?? null,
      decisionReason: row.decision_reason ?? null,
    });
  }

  private static PROPOSAL_COLUMNS = 'data, status, decided_by, decided_role, decided_at, decision_reason';

  async getProposal(id: string): Promise<ChallengeProposal | null> {
    const { data, error } = await this.client.from(PROPOSALS).select(SupabaseEvidenceStore.PROPOSAL_COLUMNS).eq('id', id).maybeSingle();
    if (error) throw new Error(`Failed to load proposal ${id}: ${error.message}`);
    return SupabaseEvidenceStore.parseProposal(data as never);
  }

  async findProposalByIdempotencyKey(key: string): Promise<ChallengeProposal | null> {
    const { data, error } = await this.client.from(PROPOSALS).select(SupabaseEvidenceStore.PROPOSAL_COLUMNS).eq('idempotency_key', key).maybeSingle();
    if (error) throw new Error(`Failed to look up idempotency key: ${error.message}`);
    return SupabaseEvidenceStore.parseProposal(data as never);
  }

  async listProposals(claimId: string): Promise<ChallengeProposal[]> {
    const { data, error } = await this.client.from(PROPOSALS).select(SupabaseEvidenceStore.PROPOSAL_COLUMNS).eq('claim_id', claimId).order('created_at', { ascending: false });
    if (error) throw new Error(`Failed to list proposals for ${claimId}: ${error.message}`);
    return (data ?? []).map((row) => SupabaseEvidenceStore.parseProposal(row as never)!);
  }

  async transitionProposal(
    id: string,
    from: ProposalStatus,
    patch: Pick<ChallengeProposal, 'status' | 'decidedBy' | 'decidedRole' | 'decidedAt' | 'decisionReason'>,
  ): Promise<boolean> {
    const { data, error } = await this.client
      .from(PROPOSALS)
      .update({
        status: patch.status,
        decided_by: patch.decidedBy,
        decided_role: patch.decidedRole,
        decided_at: patch.decidedAt,
        decision_reason: patch.decisionReason,
      })
      .eq('id', id)
      .eq('status', from)
      .select('id');
    if (error) throw new Error(`Failed to update proposal ${id}: ${error.message}`);
    return (data ?? []).length === 1;
  }

  async saveDraft(draft: AnalysisDraft): Promise<void> {
    const v = AnalysisDraftSchema.parse(draft);
    const { error } = await this.client.from(DRAFTS).insert({
      id: v.id,
      created_by: v.createdBy,
      creator_role: v.creatorRole,
      data: v,
      created_at: v.createdAt,
    });
    if (error) throw new Error(`Failed to save draft ${v.id}: ${error.message}`);
  }

  async getDraft(id: string): Promise<AnalysisDraft | null> {
    const { data, error } = await this.client.from(DRAFTS).select('data').eq('id', id).maybeSingle();
    if (error) throw new Error(`Failed to load draft ${id}: ${error.message}`);
    return data ? AnalysisDraftSchema.parse((data as { data: unknown }).data) : null;
  }
}
