/**
 * File-backed store.
 *
 * Enough to make analyses genuinely persistent, auditable and inspectable
 * without standing up a database. Writes are serialised through a promise chain
 * because Next route handlers are concurrent and two analyses persisting at
 * once would otherwise interleave their reads and writes.
 *
 * Swap for a real database via EvidenceStore when the corpus and traffic
 * warrant it; nothing above this file knows how storage works.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
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

interface StoreShape {
  analyses: Record<string, Analysis>;
  challenges: Record<string, AssessmentChallenge[]>;
  audit: AuditRecord[];
  proposals: Record<string, ChallengeProposal>;
  drafts: Record<string, AnalysisDraft>;
}

const EMPTY: StoreShape = { analyses: {}, challenges: {}, audit: [], proposals: {}, drafts: {} };

/**
 * A local file is not durable on a serverless host (read-only bundle, /tmp
 * wiped between cold starts). Outside local development it must not be
 * treated as somewhere a visitor's work can be kept.
 */
export function fileStoreIsDurableHere(): boolean {
  return process.env.NODE_ENV !== 'production' && !process.env.VERCEL;
}

export class JsonEvidenceStore implements EvidenceStore {
  readonly durable = fileStoreIsDurableHere();
  private readonly file: string;
  private queue: Promise<unknown> = Promise.resolve();
  private cache: StoreShape | null = null;

  constructor(dir = process.env.EVIDENCE_DATA_DIR || './data') {
    this.file = path.resolve(dir, 'evidence-store.json');
  }

  private async read(): Promise<StoreShape> {
    if (this.cache) return this.cache;
    try {
      const raw = await fs.readFile(this.file, 'utf8');
      const parsed = JSON.parse(raw) as StoreShape;
      this.cache = {
        analyses: parsed.analyses ?? {},
        challenges: parsed.challenges ?? {},
        audit: parsed.audit ?? [],
        proposals: parsed.proposals ?? {},
        drafts: parsed.drafts ?? {},
      };
    } catch {
      // Missing or unreadable file is the normal cold-start case.
      this.cache = structuredClone(EMPTY);
    }
    return this.cache;
  }

  private async write(mutate: (s: StoreShape) => void): Promise<void> {
    const run = this.queue.then(async () => {
      const state = await this.read();
      mutate(state);
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      // Write-then-rename so a crash mid-write cannot leave a truncated store.
      const tmp = `${this.file}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(state, null, 2), 'utf8');
      await fs.rename(tmp, this.file);
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  async saveAnalysis(analysis: Analysis): Promise<void> {
    const validated = AnalysisSchema.parse(analysis);
    await this.write((s) => {
      s.analyses[validated.id] = validated;
    });
  }

  async replaceAnalysisIfVersion(analysis: Analysis, expectedUpdatedAt: string): Promise<boolean> {
    const validated = AnalysisSchema.parse(analysis);
    let replaced = false;
    // The check runs inside the serialised write, so two decisions cannot both pass it.
    await this.write((s) => {
      const current = s.analyses[validated.id];
      if (!current || current.updatedAt !== expectedUpdatedAt) return;
      s.analyses[validated.id] = validated;
      replaced = true;
    });
    return replaced;
  }

  async saveProposal(proposal: ChallengeProposal): Promise<void> {
    const validated = ChallengeProposalSchema.parse(proposal);
    await this.write((s) => {
      if (s.proposals[validated.id]) throw new Error(`Proposal ${validated.id} already exists.`);
      s.proposals[validated.id] = validated;
    });
  }

  async getProposal(id: string): Promise<ChallengeProposal | null> {
    const s = await this.read();
    return s.proposals[id] ?? null;
  }

  async findProposalByIdempotencyKey(key: string): Promise<ChallengeProposal | null> {
    const s = await this.read();
    return Object.values(s.proposals).find((p) => p.idempotencyKey === key) ?? null;
  }

  async listProposals(claimId: string): Promise<ChallengeProposal[]> {
    const s = await this.read();
    return Object.values(s.proposals).filter((p) => p.claimId === claimId);
  }

  async transitionProposal(
    id: string,
    from: ProposalStatus,
    patch: Pick<ChallengeProposal, 'status' | 'decidedBy' | 'decidedRole' | 'decidedAt' | 'decisionReason'>,
  ): Promise<boolean> {
    let moved = false;
    await this.write((s) => {
      const p = s.proposals[id];
      if (!p || p.status !== from) return;
      s.proposals[id] = { ...p, ...patch };
      moved = true;
    });
    return moved;
  }

  async saveDraft(draft: AnalysisDraft): Promise<void> {
    const validated = AnalysisDraftSchema.parse(draft);
    await this.write((s) => {
      s.drafts[validated.id] = validated;
    });
  }

  async getDraft(id: string): Promise<AnalysisDraft | null> {
    const s = await this.read();
    return s.drafts[id] ?? null;
  }

  async getAnalysis(id: string): Promise<Analysis | null> {
    const s = await this.read();
    return s.analyses[id] ?? null;
  }

  async getAnalysisBySlug(slug: string): Promise<Analysis | null> {
    const s = await this.read();
    const normalised = slug.replace(/^\/+|\/+$/g, '');
    return (
      Object.values(s.analyses).find(
        (a) => a.passageReference?.slug === normalised || a.resourceId === normalised,
      ) ?? null
    );
  }

  async listAnalyses(): Promise<Analysis[]> {
    const s = await this.read();
    return Object.values(s.analyses).sort((a, b) => a.title.localeCompare(b.title));
  }

  async findClaim(claimId: string): Promise<{ analysis: Analysis; claimIndex: number } | null> {
    const s = await this.read();
    for (const analysis of Object.values(s.analyses)) {
      const claimIndex = analysis.claims.findIndex((c) => c.id === claimId);
      if (claimIndex !== -1) return { analysis, claimIndex };
    }
    return null;
  }

  async saveChallenge(challenge: AssessmentChallenge): Promise<void> {
    const validated = AssessmentChallengeSchema.parse(challenge);
    await this.write((s) => {
      (s.challenges[validated.claimId] ??= []).push(validated);
    });
  }

  async listChallenges(claimId: string): Promise<AssessmentChallenge[]> {
    const s = await this.read();
    return s.challenges[claimId] ?? [];
  }

  async appendAudit(record: AuditRecord): Promise<void> {
    const validated = AuditRecordSchema.parse(record);
    await this.write((s) => {
      s.audit.push(validated);
    });
  }

  async listAudit(entityId: string): Promise<AuditRecord[]> {
    const s = await this.read();
    return s.audit.filter((r) => r.entityId === entityId);
  }
}
