/**
 * The assembled AbrahamMoses record.
 *
 * Server-side only: the record version is a SHA-256 over the canonical public
 * record, so every API response and every simulation can say exactly which
 * state of the record it was computed against.
 *
 * Drafts never leave this module unless RECORD_INCLUDE_DRAFTS=1, which is for
 * local editorial preview only. Provisional revisions are public and are
 * labelled as provisional wherever they appear.
 */

import { createHash } from 'node:crypto';
import { AXIOMS } from './data/axioms';
import { CASES } from './data/cases';
import { IBRAHIM_CLAIMS } from './data/claims-ibrahim';
import { PRIESTHOOD_CLAIMS } from './data/claims-priesthood';
import { RESTORATION_CLAIMS } from './data/claims-restoration';
import { TORAH_CLAIMS } from './data/claims-torah';
import { TRANSLATIONS, WORKS } from './data/corpus';
import { COUNTER_MODELS } from './data/counter-models';
import { DERIVATIONS } from './data/derivations';
import { COVENANT_NODES, COVENANTS, DOCTRINE, DOCTRINE_NODES, MAP_LINKS } from './data/maps';
import { TRADITIONS } from './data/traditions';
import type { DependencyGraph } from './engine';
import type {
  Axiom,
  Claim,
  ClaimRevision,
  CounterModel,
  CovenantEdge,
  DoctrineEdge,
  RecordData,
  ResearchCase,
  Tradition,
  Work,
} from './schema';
import { STATUS_META, isGroundedInSource, type RevisionStatus } from './taxonomy';

/** Every entry as authored, drafts included. Used by the integrity checks and tests. */
export const RAW_RECORD: RecordData = {
  works: WORKS,
  translations: TRANSLATIONS,
  traditions: TRADITIONS,
  axioms: AXIOMS,
  claims: [...PRIESTHOOD_CLAIMS, ...TORAH_CLAIMS, ...IBRAHIM_CLAIMS, ...RESTORATION_CLAIMS].sort((a, b) =>
    a.code.localeCompare(b.code),
  ),
  derivations: DERIVATIONS,
  counterModels: COUNTER_MODELS,
  covenantNodes: COVENANT_NODES,
  covenants: COVENANTS,
  doctrineNodes: DOCTRINE_NODES,
  doctrine: DOCTRINE,
  mapLinks: MAP_LINKS,
  cases: CASES,
};

const isPublic = (s: RevisionStatus, includeDrafts: boolean) => includeDrafts || STATUS_META[s].public;

/** The public view: drafts removed, and everything that pointed at a draft removed with it. */
export function publicView(raw: RecordData, includeDrafts = false): RecordData {
  const claims: Claim[] = raw.claims
    .map((c) => ({ ...c, revisions: c.revisions.filter((r) => isPublic(r.status, includeDrafts)) }))
    .filter((c) => c.revisions.length > 0);
  const claimCodes = new Set(claims.map((c) => c.code));
  const axioms = raw.axioms.filter((a) => isPublic(a.status, includeDrafts));
  const axiomCodes = new Set(axioms.map((a) => a.code));

  return {
    ...raw,
    axioms,
    claims,
    derivations: raw.derivations.filter(
      (d) =>
        claimCodes.has(d.claim) &&
        d.premises.every((p) => claimCodes.has(p.claim)) &&
        d.axioms.every((a) => axiomCodes.has(a.axiom)),
    ),
    counterModels: raw.counterModels.filter((m) => isPublic(m.status, includeDrafts) && claimCodes.has(m.targets)),
    covenants: raw.covenants.filter((e) => isPublic(e.status, includeDrafts)),
    doctrine: raw.doctrine.filter((e) => isPublic(e.status, includeDrafts)),
    mapLinks: raw.mapLinks.filter((l) => claimCodes.has(l.claim)),
    cases: raw.cases.filter((c) => isPublic(c.status, includeDrafts)),
  };
}

/* ------------------------------------------------------------------ *
 * Canonical hashing
 * ------------------------------------------------------------------ */

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}

export function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

/** Content hash of one claim revision — what the revision lock pins. */
export function revisionHash(code: string, revision: ClaimRevision): string {
  return sha256(canonicalJson({ code, revision }));
}

/* ------------------------------------------------------------------ *
 * The indexed record
 * ------------------------------------------------------------------ */

export class AbrahamMosesRecord {
  readonly data: RecordData;
  readonly version: string;
  readonly includesDrafts: boolean;

  private readonly claimIndex: Map<string, Claim>;
  private readonly axiomIndex: Map<string, Axiom>;
  private readonly traditionIndex: Map<string, Tradition>;
  private readonly workIndex: Map<string, Work>;
  private readonly caseIndex: Map<string, ResearchCase>;
  private readonly counterIndex: Map<string, CounterModel>;
  private graphCache: DependencyGraph | null = null;

  constructor(data: RecordData, includesDrafts = false) {
    this.data = data;
    this.includesDrafts = includesDrafts;
    this.version = sha256(canonicalJson(data)).slice(0, 16);
    this.claimIndex = new Map(data.claims.map((c) => [c.code, c]));
    this.axiomIndex = new Map(data.axioms.map((a) => [a.code, a]));
    this.traditionIndex = new Map(data.traditions.map((t) => [t.id, t]));
    this.workIndex = new Map(data.works.map((w) => [w.id, w]));
    this.caseIndex = new Map(data.cases.map((c) => [c.slug, c]));
    this.counterIndex = new Map(data.counterModels.map((m) => [m.code, m]));
  }

  claim(code: string): Claim | undefined {
    return this.claimIndex.get(code.toUpperCase());
  }

  /** The latest public revision — what the record currently says. */
  current(claim: Claim): ClaimRevision {
    return claim.revisions[claim.revisions.length - 1];
  }

  revision(claim: Claim, rev: number): ClaimRevision | undefined {
    return claim.revisions.find((r) => r.rev === rev);
  }

  /** The latest revision an editor has verified, if any. */
  lastVerified(claim: Claim): ClaimRevision | undefined {
    return [...claim.revisions].reverse().find((r) => r.status === 'published' || r.status === 'externally_reviewed');
  }

  axiom(code: string): Axiom | undefined {
    return this.axiomIndex.get(code.toUpperCase());
  }

  tradition(id: string): Tradition | undefined {
    return this.traditionIndex.get(id);
  }

  work(id: string): Work | undefined {
    return this.workIndex.get(id);
  }

  researchCase(slug: string): ResearchCase | undefined {
    return this.caseIndex.get(slug);
  }

  counterModel(code: string): CounterModel | undefined {
    return this.counterIndex.get(code.toUpperCase());
  }

  derivationsOf(code: string) {
    return this.data.derivations.filter((d) => d.claim === code);
  }

  /** Derivations that use a claim as a premise. */
  dependentsOf(code: string) {
    return this.data.derivations.filter((d) => d.premises.some((p) => p.claim === code));
  }

  counterModelsFor(code: string): CounterModel[] {
    return this.data.counterModels.filter((m) => m.targets === code || m.position === code);
  }

  mapLinksFor(code: string) {
    return this.data.mapLinks.filter((l) => l.claim === code);
  }

  covenantEdge(code: string): CovenantEdge | undefined {
    return this.data.covenants.find((e) => e.code === code.toUpperCase());
  }

  doctrineEdge(code: string): DoctrineEdge | undefined {
    return this.data.doctrine.find((e) => e.code === code.toUpperCase());
  }

  claimsInCase(slug: string): Claim[] {
    return this.data.claims.filter((c) => c.cases.includes(slug));
  }

  /** The serialisable graph the dependency engine runs on, server or client. */
  graph(): DependencyGraph {
    this.graphCache ??= {
      recordVersion: this.version,
      claims: this.data.claims.map((c) => {
        const r = this.current(c);
        return {
          code: c.code,
          statement: r.statement,
          role: c.role,
          classification: r.classification,
          topic: c.topic,
          grounded: isGroundedInSource(r.classification) && r.status !== 'withdrawn',
          cases: c.cases,
        };
      }),
      axioms: this.data.axioms.map((a) => ({
        code: a.code,
        label: a.label,
        heldBy: a.heldBy,
        stances: a.stances.map((s) => ({ tradition: s.tradition, stance: s.stance })),
      })),
      derivations: this.data.derivations,
      mapLinks: this.data.mapLinks,
      counterModels: this.data.counterModels.map((m) => ({
        code: m.code,
        title: m.title,
        heldBy: m.heldBy,
        targets: m.targets,
        reliesOn: m.reliesOn,
        rejects: m.rejects,
        position: m.position,
        strength: m.strength,
      })),
    };
    return this.graphCache;
  }

  /** Every revision across the record, newest first — the update history. */
  history(): Array<{ code: string; revision: ClaimRevision }> {
    return this.data.claims
      .flatMap((c) => c.revisions.map((revision) => ({ code: c.code, revision })))
      .sort((a, b) => b.revision.publishedAt.localeCompare(a.revision.publishedAt) || a.code.localeCompare(b.code));
  }
}

let instance: AbrahamMosesRecord | null = null;

export function getRecord(): AbrahamMosesRecord {
  if (instance) return instance;
  const includeDrafts = process.env.RECORD_INCLUDE_DRAFTS === '1';
  instance = new AbrahamMosesRecord(publicView(RAW_RECORD, includeDrafts), includeDrafts);
  return instance;
}

/** Test seam. */
export function resetRecord(): void {
  instance = null;
}
