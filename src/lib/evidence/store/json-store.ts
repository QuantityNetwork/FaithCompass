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
  type Analysis,
  type AssessmentChallenge,
  type AuditRecord,
} from '../schema';
import type { EvidenceStore } from './types';

interface StoreShape {
  analyses: Record<string, Analysis>;
  challenges: Record<string, AssessmentChallenge[]>;
  audit: AuditRecord[];
}

const EMPTY: StoreShape = { analyses: {}, challenges: {}, audit: [] };

export class JsonEvidenceStore implements EvidenceStore {
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
