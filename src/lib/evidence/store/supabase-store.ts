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
  type Analysis,
  type AssessmentChallenge,
  type AuditRecord,
} from '../schema';
import type { EvidenceStore } from './types';

const ANALYSES = 'evidence_analyses';
const CHALLENGES = 'evidence_challenges';
const AUDIT = 'evidence_audit';

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
}
