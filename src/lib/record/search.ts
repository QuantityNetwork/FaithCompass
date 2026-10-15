/**
 * Research retrieval over the published record.
 *
 * Deterministic and generative-free: a question is matched against cases,
 * claims, axioms, counter-models and map edges by weighted term overlap, with
 * scripture references parsed out and matched against the witnesses claims
 * cite. Nothing is composed by a model, so every line of a result is a record
 * a reader can open.
 */

import { checkRequest, type GuardrailFinding } from '@/lib/evidence/guardrails';
import { WORKS } from './data/corpus';
import type { AbrahamMosesRecord } from './record';
import type { Claim, Reference, ResearchCase } from './schema';

/* ------------------------------------------------------------------ *
 * Normalisation
 * ------------------------------------------------------------------ */

const STOPWORDS = new Set(
  'a an and are as at be been but by can could did do does for from had has have how i if in into is it its may might of on or our shall should so than that the their them then there these they this those to under upon us was we were what when where which while who whom whose why will with would you your about after before between concerning say says said there'.split(
    ' ',
  ),
);

/** Transliteration and name variants mapped to one search term. */
const SYNONYMS: Record<string, string> = {
  ibrahim: 'abraham',
  avraham: 'abraham',
  ismail: 'ishmael',
  ismael: 'ishmael',
  ishaq: 'isaac',
  yitzhak: 'isaac',
  isa: 'jesus',
  musa: 'moses',
  moshe: 'moses',
  dawud: 'david',
  nuh: 'noah',
  quran: 'quran',
  koran: 'quran',
  tawrat: 'torah',
  injil: 'gospel',
  mormon: 'latterday',
  lds: 'latterday',
  latter: 'latterday',
  mitzvot: 'commandment',
  mitzvah: 'commandment',
  commandments: 'commandment',
  law: 'law',
  laws: 'law',
  priests: 'priest',
  priestly: 'priest',
  priesthood: 'priesthood',
  covenants: 'covenant',
  prophets: 'prophet',
  prophetic: 'prophet',
  kaba: 'kaaba',
  khatam: 'seal',
  abrogate: 'abrogation',
  abrogated: 'abrogation',
  abrogates: 'abrogation',
  annul: 'abrogation',
  annulled: 'abrogation',
  supersede: 'supersession',
  superseded: 'supersession',
  supersedes: 'supersession',
  heirs: 'heir',
  children: 'heir',
  descendants: 'heir',
  seed: 'heir',
  changed: 'change',
  changes: 'change',
};

export function normalise(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ʿʾ’'‘`]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function tokens(text: string): string[] {
  return normalise(text)
    .split(' ')
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map((t) => SYNONYMS[t] ?? (t.length > 4 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t));
}

/* ------------------------------------------------------------------ *
 * References in a query
 * ------------------------------------------------------------------ */

export interface QueryReference {
  work: string;
  display: string;
  chapter: number | null;
}

const ALIASES = WORKS.filter((w) => w.category === 'primary_text' || w.id === 'septuagint')
  .flatMap((w) => [w.citeAs, ...w.aliases, w.title].map((alias) => ({ alias, work: w.id })))
  .sort((a, b) => b.alias.length - a.alias.length);

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function referencesIn(query: string): QueryReference[] {
  const found: QueryReference[] = [];
  const taken: Array<[number, number]> = [];
  for (const { alias, work } of ALIASES) {
    const pattern = new RegExp(`(^|[^A-Za-z])(${escape(alias)})\\.?\\s*(\\d+)?(?::(\\d+))?`, 'gi');
    for (const m of query.matchAll(pattern)) {
      const start = m.index! + m[1].length;
      const end = m.index! + m[0].length;
      if (taken.some(([s, e]) => start < e && end > s)) continue;
      // A bare short alias ("Q", "Gen") without a chapter is too ambiguous to treat as a reference.
      if (!m[3] && alias.length < 5) continue;
      taken.push([start, end]);
      found.push({ work, display: m[0].slice(m[1].length).trim(), chapter: m[3] ? Number(m[3]) : null });
    }
  }
  return found;
}

/** Chapter range of a record reference, when its locator is numeric. */
export function chapterRange(ref: Reference): [number, number] | null {
  // "5:6" and "31:31-34" are one chapter; "7–10" and "28-29" are a span of chapters.
  const m = ref.locator.match(/^(\d+)(?::[\d–-]+)?(?:\s*[–-]\s*(\d+))?/);
  if (!m) return null;
  const start = Number(m[1]);
  const end = m[2] ? Number(m[2]) : start;
  return [start, Math.max(start, end)];
}

function referenceMatches(q: QueryReference, ref: Reference): boolean {
  if (q.work !== ref.work) return false;
  if (q.chapter === null) return true;
  const range = chapterRange(ref);
  return range !== null && q.chapter >= range[0] && q.chapter <= range[1];
}

/* ------------------------------------------------------------------ *
 * Index
 * ------------------------------------------------------------------ */

type Kind = 'case' | 'claim' | 'axiom' | 'counter_model' | 'covenant' | 'doctrine';

interface Doc {
  kind: Kind;
  id: string;
  terms: Map<string, number>;
  length: number;
  refs: Reference[];
  aliases: string[];
}

function bag(fields: Array<[string, number]>): { terms: Map<string, number>; length: number } {
  const terms = new Map<string, number>();
  let length = 0;
  for (const [text, weight] of fields) {
    for (const t of tokens(text)) {
      terms.set(t, (terms.get(t) ?? 0) + weight);
      length += weight;
    }
  }
  return { terms, length };
}

const INDEX_CACHE = new WeakMap<AbrahamMosesRecord, { docs: Doc[]; df: Map<string, number>; avg: number }>();

function buildIndex(record: AbrahamMosesRecord) {
  const cached = INDEX_CACHE.get(record);
  if (cached) return cached;

  const docs: Doc[] = [];
  for (const rc of record.data.cases) {
    docs.push({
      kind: 'case',
      id: rc.slug,
      ...bag([
        [rc.title, 3],
        [rc.question, 3],
        [rc.aliases.join(' '), 2],
        [rc.summary, 1],
      ]),
      refs: [],
      aliases: rc.aliases.map(normalise),
    });
  }
  for (const c of record.data.claims) {
    const r = record.current(c);
    docs.push({
      kind: 'claim',
      id: c.code,
      ...bag([
        [r.statement, 3],
        [c.topic, 2],
        [r.interpretiveDivergence, 1],
        [r.primaryWitnesses.map((w) => w.display).join(' '), 1],
      ]),
      refs: [...r.primaryWitnesses, ...r.evidence.map((e) => e.reference)],
      aliases: [],
    });
  }
  for (const a of record.data.axioms) {
    docs.push({ kind: 'axiom', id: a.code, ...bag([[a.label, 3], [a.statement, 2], [a.heldBy, 1]]), refs: [], aliases: [] });
  }
  for (const m of record.data.counterModels) {
    docs.push({
      kind: 'counter_model',
      id: m.code,
      ...bag([[m.title, 3], [m.thesis, 2], [m.heldBy, 1]]),
      refs: m.evidence,
      aliases: [],
    });
  }
  const label = (id: string, nodes: Array<{ id: string; label: string }>) => nodes.find((n) => n.id === id)?.label ?? id;
  for (const e of record.data.covenants) {
    docs.push({
      kind: 'covenant',
      id: e.code,
      ...bag([
        [`${label(e.source, record.data.covenantNodes)} ${label(e.target, record.data.covenantNodes)}`, 2],
        [e.description, 1],
      ]),
      refs: e.evidence,
      aliases: [],
    });
  }
  for (const e of record.data.doctrine) {
    docs.push({
      kind: 'doctrine',
      id: e.code,
      ...bag([
        [`${label(e.source, record.data.doctrineNodes)} ${label(e.target, record.data.doctrineNodes)}`, 2],
        [`${e.relationshipType} ${e.description}`, 1],
      ]),
      refs: e.evidence,
      aliases: [],
    });
  }

  const df = new Map<string, number>();
  for (const d of docs) for (const t of d.terms.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  const avg = docs.reduce((s, d) => s + d.length, 0) / docs.length;
  const built = { docs, df, avg };
  INDEX_CACHE.set(record, built);
  return built;
}

/* ------------------------------------------------------------------ *
 * Search
 * ------------------------------------------------------------------ */

export interface Hit {
  kind: Kind;
  id: string;
  score: number;
  /** Why it matched: terms in common, references, or a case alias. */
  matched: string[];
}

export interface SearchResult {
  query: string;
  guardrail: GuardrailFinding | null;
  references: QueryReference[];
  /** The research case the question belongs to, when one clearly matches. */
  bestCase: ResearchCase | null;
  hits: Hit[];
  claims: Array<{ claim: Claim; score: number; matched: string[] }>;
  traditions: string[];
}

const K1 = 1.2;
const B = 0.6;

export function search(record: AbrahamMosesRecord, query: string, opts: { limit?: number } = {}): SearchResult {
  const limit = opts.limit ?? 12;
  const q = query.trim().slice(0, 500);
  const guard = checkRequest(q);
  const references = referencesIn(q);
  const qTerms = [...new Set(tokens(q))];
  const qNorm = ` ${normalise(q)} `;
  const { docs, df, avg } = buildIndex(record);
  const n = docs.length;

  const hits: Hit[] = [];
  for (const d of docs) {
    let score = 0;
    const matched: string[] = [];
    for (const t of qTerms) {
      const tf = d.terms.get(t);
      if (!tf) continue;
      const idf = Math.log(1 + (n - (df.get(t) ?? 0) + 0.5) / ((df.get(t) ?? 0) + 0.5));
      score += (idf * tf * (K1 + 1)) / (tf + K1 * (1 - B + (B * d.length) / avg));
      matched.push(t);
    }
    for (const r of references) {
      if (d.refs.some((ref) => referenceMatches(r, ref))) {
        score += 6;
        matched.push(r.display);
      }
    }
    for (const alias of d.aliases) {
      if (qNorm.includes(` ${alias} `)) {
        score += 4 + alias.split(' ').length;
        matched.push(alias);
      }
    }
    if (score > 0) hits.push({ kind: d.kind, id: d.id, score: Math.round(score * 100) / 100, matched });
  }
  hits.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  // A case is "the" answer only when it clearly leads: a strong score, ahead of the next case.
  const caseHits = hits.filter((h) => h.kind === 'case');
  const top = caseHits[0];
  const runnerUp = caseHits[1];
  const bestCase = top && top.score >= 6 && (!runnerUp || top.score >= runnerUp.score * 1.25) ? record.researchCase(top.id)! : null;

  const claims = hits
    .filter((h) => h.kind === 'claim')
    .slice(0, limit)
    .map((h) => ({ claim: record.claim(h.id)!, score: h.score, matched: h.matched }));

  const lower = normalise(q);
  const traditions = record.data.traditions
    .filter((t) => tokens(t.name).every((tok) => tokens(lower).includes(tok)))
    .map((t) => t.id);

  return { query: q, guardrail: guard.allowed ? null : guard.finding, references, bestCase, hits, claims, traditions };
}
