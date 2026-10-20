/**
 * Generator for benchmarks/decision-evidence-v1: 40 FICTIONAL cases (10 private credit, 10 M&A, 10 contract,
 * 10 scholarly). Every entity, document, number and quotation is invented; any resemblance is accidental.
 *
 * Gold annotations come from construction: each case is assembled from "plants" (a pair of statements whose
 * correct reading is fixed by the annotation guide in README.md, §Gold). The guide was written from the brief's class
 * definitions, and several plant types deliberately fall outside the rules of the previous Decision Twin (entity
 * abbreviations, concept synonyms, unit words, fiscal year ends, legal-entity suffixes, stated approximations).
 *
 * Deterministic: seed 20261020. Run: npx tsx benchmarks/decision-evidence-v1/generate.ts
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'benchmarks/decision-evidence-v1');
const SEED = 20261020;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const R = rng(SEED);
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(R() * xs.length)];
const round = (v: number, d = 1) => Math.round(v * 10 ** d) / 10 ** d;

type Gold = 'CONFIRMED_CONFLICT' | 'POTENTIAL_CONFLICT' | 'DIFFERENT_REPORTING_BASIS' | 'MISSING_EVIDENCE' | 'UNRESOLVED_INTERPRETATION' | 'NONE';
interface Stmt {
  entity: string;
  concept: string;
  label: string;
  value: number | string | boolean | null;
  unit?: string | null;
  period?: string | null;
  basis?: string | null;
  definition?: string | null;
  version?: string | null;
  effectiveDate?: string | null;
  scope?: string | null;
  exclusiveGroup?: string | null;
  /** How the value is written in the document text. */
  shown?: string;
  qualifier?: string;
}
interface Plant {
  type: string;
  gold: Gold;
  a: Stmt;
  b: Stmt;
  note: string;
}

/* ------------------------------------------------------------------ domains */

interface Quantity {
  concept: string;
  label: string;
  synonym: [string, string];
  base: [number, number];
  unit: string;
}
interface TextTerm {
  concept: string;
  label: string;
  readings: [string, string];
}
interface Choice {
  group: string;
  label: string;
  options: [string, string];
}
interface Domain {
  key: string;
  prefix: string;
  names: string[];
  docTitles: [string, string, string];
  quantities: Quantity[];
  texts: TextTerm[];
  choices: Choice[];
  decision: string;
}

const COMPANY_A = ['Northwind', 'Calder', 'Brightwater', 'Osprey', 'Halvard', 'Meridian Vale', 'Tamsin', 'Corvane', 'Lindqvist', 'Esker', 'Pellwood', 'Ardent Fold', 'Quillon', 'Sorrel', 'Vantor', 'Harrowgate', 'Elmbrook', 'Kestrel Point'];
const SUFFIX = ['Holdings', 'Group', 'Industries', 'Partners', 'Systems'];

const DOMAINS: Domain[] = [
  {
    key: 'private_credit', prefix: 'pc', names: COMPANY_A,
    docTitles: ['Audited financial statements', 'Lender presentation', 'Compliance certificate'],
    quantities: [
      { concept: 'net_debt', label: 'net debt', synonym: ['net_debt', 'net_financial_debt'], base: [80, 400], unit: '$m' },
      { concept: 'ebitda', label: 'EBITDA', synonym: ['ebitda', 'operating_cash_earnings'], base: [20, 90], unit: '$m' },
      { concept: 'revenue', label: 'revenue', synonym: ['revenue', 'net_sales'], base: [150, 900], unit: '$m' },
      { concept: 'interest_cover', label: 'interest cover', synonym: ['interest_cover', 'interest_coverage_ratio'], base: [1.5, 6], unit: 'x' },
      { concept: 'liquidity', label: 'available liquidity', synonym: ['liquidity', 'available_liquidity'], base: [10, 60], unit: '$m' },
      { concept: 'capex', label: 'capital expenditure', synonym: ['capex', 'capital_expenditure'], base: [5, 40], unit: '$m' },
      { concept: 'customer_concentration', label: 'largest-customer share of revenue', synonym: ['customer_concentration', 'top_customer_share'], base: [8, 35], unit: '%' },
      { concept: 'cash_margin', label: 'cash interest margin', synonym: ['cash_margin', 'cash_interest_margin'], base: [4, 8], unit: '%' },
    ],
    texts: [
      { concept: 'permitted_basket', label: 'permitted acquisitions basket', readings: ['capped at the greater of $15m and 20% of EBITDA', 'uncapped where pro forma leverage stays below 4.0x'] },
      { concept: 'ebitda_addbacks', label: 'treatment of restructuring add-backs', readings: ['add-backs limited to costs incurred within 12 months', 'add-backs include expected future synergies'] },
    ],
    choices: [{ group: 'sponsor_support', label: 'sponsor equity cure', options: ['equity cure available twice over the life of the facility', 'no equity cure right'] }],
    decision: 'the credit committee approval',
  },
  {
    key: 'm_and_a', prefix: 'ma', names: COMPANY_A,
    docTitles: ['Information memorandum', 'Financial due diligence report', 'Draft share purchase agreement'],
    quantities: [
      { concept: 'enterprise_value', label: 'enterprise value', synonym: ['enterprise_value', 'headline_valuation'], base: [200, 1500], unit: '$m' },
      { concept: 'ebitda', label: 'EBITDA', synonym: ['ebitda', 'operating_cash_earnings'], base: [20, 140], unit: '$m' },
      { concept: 'revenue', label: 'revenue', synonym: ['revenue', 'net_sales'], base: [100, 800], unit: '$m' },
      { concept: 'net_working_capital', label: 'normalised net working capital', synonym: ['net_working_capital', 'trade_working_capital'], base: [10, 90], unit: '$m' },
      { concept: 'earn_out', label: 'maximum earn-out', synonym: ['earn_out', 'contingent_consideration'], base: [10, 120], unit: '$m' },
      { concept: 'headcount', label: 'employees', synonym: ['headcount', 'fte'], base: [200, 3000], unit: 'count' },
      { concept: 'gross_margin', label: 'gross margin', synonym: ['gross_margin', 'gross_profit_margin'], base: [25, 60], unit: '%' },
      { concept: 'customer_churn', label: 'annual customer churn', synonym: ['customer_churn', 'logo_churn'], base: [3, 18], unit: '%' },
    ],
    texts: [
      { concept: 'locked_box', label: 'leakage definition', readings: ['permitted leakage excludes management bonuses', 'management bonuses are permitted leakage up to $2m'] },
      { concept: 'mac_clause', label: 'material adverse change clause', readings: ['excludes general market downturns', 'covers any event reducing EBITDA by more than 10%'] },
    ],
    choices: [{ group: 'consideration_form', label: 'form of consideration', options: ['all-cash consideration', 'part-share consideration with a 12-month lock-up'] }],
    decision: 'the investment committee bid recommendation',
  },
  {
    key: 'contract', prefix: 'ct', names: COMPANY_A,
    docTitles: ['Master services agreement', 'Amendment letter', 'Supplier summary memo'],
    quantities: [
      { concept: 'liability_cap', label: 'liability cap', synonym: ['liability_cap', 'aggregate_liability_limit'], base: [1, 25], unit: '$m' },
      { concept: 'annual_fee', label: 'annual fee', synonym: ['annual_fee', 'yearly_charges'], base: [0.5, 12], unit: '$m' },
      { concept: 'notice_period', label: 'termination notice period', synonym: ['notice_period', 'termination_notice'], base: [30, 180], unit: 'days' },
      { concept: 'service_credit', label: 'maximum service credit', synonym: ['service_credit', 'sla_credit_cap'], base: [5, 20], unit: '%' },
      { concept: 'uptime_commitment', label: 'availability commitment', synonym: ['uptime_commitment', 'availability_sla'], base: [99, 99.95], unit: '%' },
      { concept: 'price_escalator', label: 'annual price escalator', synonym: ['price_escalator', 'indexation_cap'], base: [2, 7], unit: '%' },
      { concept: 'term_years', label: 'initial term', synonym: ['term_years', 'initial_term'], base: [2, 7], unit: 'years' },
      { concept: 'insurance_cover', label: 'professional indemnity cover', synonym: ['insurance_cover', 'pi_insurance'], base: [2, 20], unit: '$m' },
    ],
    texts: [
      { concept: 'governing_law', label: 'governing law', readings: ['English law, London-seated arbitration', 'Swedish law, Stockholm courts'] },
      { concept: 'data_location', label: 'data residency obligation', readings: ['customer data stays within the EEA', 'customer data may be processed by approved sub-processors worldwide'] },
    ],
    choices: [{ group: 'renewal', label: 'renewal', options: ['renews automatically for successive 12-month terms', 'expires at the end of the initial term unless renewed in writing'] }],
    decision: 'the contract signature recommendation',
  },
  {
    key: 'scholarly', prefix: 'sc', names: ['Codex Aldane', 'Psalter of Vireo', 'Tellmar Fragments', 'Ostrava Chronicle', 'Book of Hessin', 'Mareth Scroll', 'Corrin Gospel-book', 'Liber Quandos', 'Sedra Letters', 'Pelham Annals', 'Odran Hymnal', 'Varro Glosses'],
    docTitles: ['Critical edition introduction', 'Catalogue entry', 'Review article'],
    quantities: [
      { concept: 'folio_count', label: 'number of surviving folios', synonym: ['folio_count', 'leaf_count'], base: [40, 400], unit: 'count' },
      { concept: 'scribal_hands', label: 'number of scribal hands', synonym: ['scribal_hands', 'copyists'], base: [2, 9], unit: 'count' },
      { concept: 'witness_count', label: 'number of known witnesses', synonym: ['witness_count', 'manuscript_witnesses'], base: [3, 60], unit: 'count' },
      { concept: 'lacunae_share', label: 'share of text lost to lacunae', synonym: ['lacunae_share', 'text_loss'], base: [3, 30], unit: '%' },
      { concept: 'line_count', label: 'lines per page', synonym: ['line_count', 'lines_per_page'], base: [18, 40], unit: 'count' },
      { concept: 'radiocarbon_median', label: 'radiocarbon median date (CE)', synonym: ['radiocarbon_median', 'c14_median'], base: [700, 1300], unit: 'year' },
      { concept: 'variant_readings', label: 'recorded variant readings', synonym: ['variant_readings', 'apparatus_entries'], base: [120, 2400], unit: 'count' },
      { concept: 'quire_count', label: 'number of quires', synonym: ['quire_count', 'gatherings'], base: [5, 40], unit: 'count' },
    ],
    texts: [
      { concept: 'colophon_reading', label: 'reading of the colophon', readings: ['names the scribe as a monk of the house', 'names the scribe as a lay copyist hired by the house'] },
      { concept: 'key_term', label: 'meaning of the term "ordo" in book II', readings: ['a liturgical order of service', 'a social rank within the community'] },
    ],
    choices: [{ group: 'provenance', label: 'place of origin', options: ['copied in the northern scriptorium', 'copied in the southern scriptorium'] }],
    decision: 'the edition\'s dating and stemma argument',
  },
];

/* ------------------------------------------------------------------- plants */

const fmt = (v: number, unit: string) => {
  const n = Number.isInteger(v) ? String(v) : String(v);
  if (unit === '$m') return `$${n}m`;
  if (unit === '$k') return `$${n}k`;
  if (unit === 'USD million') return `USD ${n} million`;
  if (unit === '%') return `${n}%`;
  if (unit === 'x') return `${n}x`;
  if (unit === 'count') return n;
  return `${n} ${unit}`;
};
const valueFor = (q: Quantity) => (q.unit === 'count' || q.unit === 'days' || q.unit === 'year' || q.unit === 'years' ? Math.round(q.base[0] + R() * (q.base[1] - q.base[0])) : round(q.base[0] + R() * (q.base[1] - q.base[0]), q.unit === '%' && q.base[1] > 99 ? 2 : 1));
const differ = (q: Quantity, v: number) => {
  const step = q.unit === 'count' || q.unit === 'days' || q.unit === 'year' || q.unit === 'years' ? Math.max(1, Math.round(v * (0.08 + R() * 0.2))) : round(v * (0.08 + R() * 0.2), q.unit === '%' && q.base[1] > 99 ? 2 : 1) || 0.1;
  return R() < 0.5 ? round(v + step, 2) : round(Math.max(v - step, step / 2), 2);
};

const FY = ['FY2024', 'FY2025'];
const QUANT_PLANTS = ['confirmed', 'basis', 'potential', 'missing', 'diff_period', 'unit_scale', 'rounding', 'superseded', 'diff_entity', 'alias', 'synonym', 'unit_word', 'fiscal_year_end', 'legal_entity', 'approximation'] as const;
type QuantPlant = (typeof QUANT_PLANTS)[number];

function quantPlant(type: QuantPlant, q: Quantity, entity: string, abbrev: string): Plant {
  const v = valueFor(q);
  const w = differ(q, v);
  const period = pick(FY);
  const base: Stmt = { entity, concept: q.concept, label: q.label, value: v, unit: q.unit, period, basis: q.unit === '$m' ? 'reported' : null };
  const S = (o: Partial<Stmt>): Stmt => ({ ...base, ...o });
  switch (type) {
    case 'confirmed':
      return { type, gold: 'CONFIRMED_CONFLICT', a: S({}), b: S({ value: w }), note: 'same entity, concept, period, unit and basis; values differ beyond rounding' };
    case 'basis':
      return { type, gold: 'DIFFERENT_REPORTING_BASIS', a: S({ basis: 'reported' }), b: S({ basis: 'adjusted (management definition)', value: w }), note: 'the same quantity on a stated different basis' };
    case 'potential':
      return { type, gold: 'POTENTIAL_CONFLICT', a: S({}), b: S({ period: null, value: w }), note: 'values differ; the second statement gives no period' };
    case 'missing':
      return { type, gold: 'MISSING_EVIDENCE', a: S({}), b: S({ value: null, shown: 'not provided' }), note: 'one document is silent where the other states a value' };
    case 'diff_period': {
      const other = period === 'FY2024' ? 'FY2025' : 'FY2024';
      return { type, gold: 'NONE', a: S({}), b: S({ period: other, value: w }), note: 'different fiscal years: two facts, not a conflict' };
    }
    case 'unit_scale':
      if (q.unit !== '$m') return quantPlant('rounding', q, entity, abbrev);
      return { type, gold: 'NONE', a: S({}), b: S({ unit: '$k', value: Math.round(v * 1000) }), note: 'the same amount in thousands' };
    case 'rounding':
      return { type, gold: 'NONE', a: S({}), b: S({ value: round(v * 1.002, 3) }), note: 'difference within rounding (0.2%)' };
    case 'superseded':
      return { type, gold: 'NONE', a: S({ version: 'original agreement' }), b: S({ version: 'amendment no. 1 (supersedes)', value: w }), note: 'a later version replaces the earlier figure' };
    case 'diff_entity':
      return { type, gold: 'NONE', a: S({}), b: S({ entity: `${entity.split(' ')[0]} Logistics subsidiary`, value: w }), note: 'a subsidiary, not the same entity' };
    case 'alias':
      return { type, gold: 'CONFIRMED_CONFLICT', a: S({}), b: S({ entity: abbrev, value: w }), note: `"${abbrev}" is defined in the documents as ${entity}` };
    case 'synonym':
      return { type, gold: 'CONFIRMED_CONFLICT', a: S({ concept: q.synonym[0] }), b: S({ concept: q.synonym[1], value: w }), note: `"${q.synonym[1]}" is defined as the same measure as "${q.synonym[0]}"` };
    case 'unit_word':
      if (q.unit !== '$m') return quantPlant('confirmed', q, entity, abbrev);
      return { type, gold: 'CONFIRMED_CONFLICT', a: S({}), b: S({ unit: 'USD million', value: w }), note: '"USD million" is the same unit as $m' };
    case 'fiscal_year_end':
      return { type, gold: 'CONFIRMED_CONFLICT', a: S({ period: 'FY2025', definition: null, qualifier: 'fiscal year ending 30 June 2025' }), b: S({ period: 'LTM to 30 Jun 2025', value: w }), note: 'the fiscal year ends 30 June, so FY2025 and LTM to 30 June 2025 are the same twelve months' };
    case 'legal_entity':
      return { type, gold: 'NONE', a: S({ entity: `${entity.split(' ')[0]} AB` }), b: S({ entity: `${entity.split(' ')[0]} Ltd`, value: w }), note: 'two different legal entities (Swedish AB and UK Ltd) in one group' };
    case 'approximation':
      return { type, gold: 'NONE', a: S({}), b: S({ value: q.unit === 'count' ? Math.round(v * 0.97) : round(v * 0.97, 0) || v, qualifier: 'approximately' }), note: 'a stated approximation consistent with the exact figure (3%)' };
  }
}

function textPlant(t: TextTerm, entity: string): Plant {
  return { type: 'interpretation', gold: 'UNRESOLVED_INTERPRETATION', a: { entity, concept: t.concept, label: t.label, value: t.readings[0], unit: 'text' }, b: { entity, concept: t.concept, label: t.label, value: t.readings[1], unit: 'text' }, note: 'two readings of one term; needs a human reading' };
}
function choicePlant(c: Choice, entity: string): Plant {
  return { type: 'exclusive', gold: 'CONFIRMED_CONFLICT', a: { entity, concept: `${c.group}_a`, label: c.label, value: true, exclusiveGroup: c.group, shown: c.options[0] }, b: { entity, concept: `${c.group}_b`, label: c.label, value: false, exclusiveGroup: c.group, shown: c.options[1] }, note: 'mutually exclusive options both asserted' };
}

/* -------------------------------------------------------------------- cases */

function sentence(s: Stmt): string {
  const subject = s.entity;
  const when = [s.period ? `for ${s.period}` : '', s.qualifier && s.qualifier !== 'approximately' ? `(${s.qualifier})` : ''].filter(Boolean).join(' ');
  const basis = s.basis ? ` on a ${s.basis} basis` : '';
  const version = s.version ? ` under the ${s.version}` : '';
  if (s.exclusiveGroup) return `For ${subject}, the ${s.label} is: ${s.shown}.`;
  if (s.unit === 'text') return `For ${subject}, the ${s.label} is read as: ${s.value}.`;
  if (s.value === null) return `${subject}: ${s.label.replace(/_/g, ' ')} ${when}${basis}${version} — ${s.shown ?? 'not provided'}.`.replace(/\s+/g, ' ');
  const label = s.concept !== s.label.replace(/[^a-z]+/gi, '_').toLowerCase() && !s.label.includes(s.concept.replace(/_/g, ' ')) ? s.concept.replace(/_/g, ' ') : s.label;
  return `${subject} ${s.qualifier === 'approximately' ? 'reports approximately' : 'reports'} ${label} of ${fmt(s.value as number, s.unit ?? '')}${when ? ' ' + when : ''}${basis}${version}.`.replace(/\s+/g, ' ');
}

interface Case {
  id: string;
  domain: string;
  split: 'dev' | 'eval';
  fictional: true;
  title: string;
  entity: string;
  documents: { id: string; title: string; text: string }[];
  spans: { id: string; doc: string; start: number; end: number; text: string }[];
  facts: Record<string, unknown>[];
  conclusions: { id: string; text: string }[];
  gold: {
    pairs: { facts: [string, string]; class: Gold; plant: string; note: string }[];
    /** Per conclusion: each required input and the statements that are acceptable evidence for it. */
    inputs: Record<string, { input: string; acceptable: string[] }[]>;
    dependencies: Record<string, string[]>;
  };
}

function buildCase(d: Domain, i: number): Case {
  const name = d.names[(i * 7 + 3) % d.names.length];
  const entity = d.key === 'scholarly' ? name : `${name} ${pick(SUFFIX)}`;
  const abbrev = entity.split(/\s+/).map((w) => w[0]).join('').toUpperCase() + (d.key === 'scholarly' ? '-MS' : 'H');
  // Choose 6 distinct quantities; plant types rotate so all types occur across the domain.
  const qs = [...d.quantities];
  for (let k = qs.length - 1; k > 0; k--) {
    const j = Math.floor(R() * (k + 1));
    [qs[k], qs[j]] = [qs[j], qs[k]];
  }
  qs.length = 6;
  const types: QuantPlant[] = [];
  for (let k = 0; k < 6; k++) types.push(QUANT_PLANTS[(i * 6 + k + d.prefix.charCodeAt(0)) % QUANT_PLANTS.length]);
  const plants: Plant[] = qs.map((q, k) => quantPlant(types[k], q, entity, abbrev));
  if (i % 2 === 0) plants.push(textPlant(d.texts[(i / 2) % d.texts.length], entity));
  if (i % 3 === 0) plants.push(choicePlant(d.choices[0], entity));

  // Lay statements into three documents: plant side a → doc 1 or 2, side b → another doc.
  const docs: { id: string; title: string; sentences: { stmt: Stmt; plant: number; side: 'a' | 'b' }[] }[] = d.docTitles.map((t, k) => ({ id: `D${k + 1}`, title: t, sentences: [] }));
  plants.forEach((p, k) => {
    const da = k % 3;
    const db = (da + 1 + (k % 2)) % 3;
    docs[da].sentences.push({ stmt: p.a, plant: k, side: 'a' });
    docs[db].sentences.push({ stmt: p.b, plant: k, side: 'b' });
  });
  const spans: Case['spans'] = [];
  const facts: Case['facts'] = [];
  const ids: Record<string, string> = {};
  const documents = docs.map((doc) => {
    let text = `${doc.title} — ${entity} (fictional).\n`;
    if (doc.id === 'D1') text += `In this document "${abbrev}" means ${entity}. `;
    doc.sentences.forEach((s, n) => {
      const sent = sentence(s.stmt);
      const id = `${doc.id}#s${n + 1}`;
      const start = text.length;
      text += sent + ' ';
      spans.push({ id, doc: doc.id, start, end: start + sent.length, text: sent });
      ids[`${s.plant}${s.side}`] = id;
      const { label, shown, qualifier, ...fact } = s.stmt;
      void label; void shown;
      facts.push({ id, ...fact, ...(qualifier === 'approximately' ? { qualifier } : {}) });
    });
    return { id: doc.id, title: doc.title, text: text.trim() };
  });
  // The synonym definitions and the fiscal-year statement are in the text, so a reader can resolve them.
  const syn = plants.filter((p) => p.type === 'synonym');
  if (syn.length) documents[2].text += ' ' + syn.map((p) => `"${p.b.concept.replace(/_/g, ' ')}" has the same meaning as "${p.a.concept.replace(/_/g, ' ')}".`).join(' ');
  if (plants.some((p) => p.type === 'fiscal_year_end')) documents[0].text += ` The fiscal year of ${entity} ends on 30 June.`;

  const pairs = plants.map((p, k) => ({ facts: [ids[`${k}a`], ids[`${k}b`]] as [string, string], class: p.gold, plant: p.type, note: p.note }));
  // Conclusion inputs: quantity plants whose statements are about this entity's figure for one period (not
  // legal_entity or diff_period). Acceptable evidence per input: superseded → the amendment only; diff_entity → the
  // group statement only; every other plant → either statement (both describe the input). A conclusion depends on
  // exactly its acceptable statements.
  const usable = plants.slice(0, 6).map((p, k) => ({ p, k })).filter(({ p }) => p.type !== 'legal_entity' && p.type !== 'diff_period');
  const accept = ({ p, k }: { p: Plant; k: number }) => (p.type === 'superseded' ? [ids[`${k}b`]] : p.type === 'diff_entity' ? [ids[`${k}a`]] : [ids[`${k}a`], ids[`${k}b`]]);
  const groups = [usable.slice(0, 2), usable.slice(2, 3)].filter((g) => g.length);
  const conclusions = groups.map((g, k) => ({ id: `C${k + 1}`, text: `The ${g.map(({ p }) => p.a.label).join(' and ')} of ${entity} ${g.length > 1 ? 'support' : 'supports'} ${d.decision}` }));
  const inputs = Object.fromEntries(conclusions.map((c, k) => [c.id, groups[k].map((u) => ({ input: u.p.a.label, acceptable: accept(u).sort() }))]));
  const dependencies = Object.fromEntries(conclusions.map((c, k) => [c.id, groups[k].flatMap(accept).sort()]));
  return {
    id: `${d.prefix}-${String(i + 1).padStart(2, '0')}`,
    domain: d.key,
    split: i < 3 ? 'dev' : 'eval',
    fictional: true,
    title: `${entity}: ${d.key.replace(/_/g, ' ')} review (fictional)`,
    entity,
    documents,
    spans,
    facts,
    conclusions,
    gold: { pairs, inputs, dependencies },
  };
}

rmSync(join(ROOT, 'cases'), { recursive: true, force: true });
mkdirSync(join(ROOT, 'cases/dev'), { recursive: true });
mkdirSync(join(ROOT, 'cases/eval'), { recursive: true });
const manifest: { file: string; sha256: string }[] = [];
const counts: Record<string, number> = {};
for (const d of DOMAINS) for (let i = 0; i < 10; i++) {
  const c = buildCase(d, i);
  const file = `cases/${c.split}/${c.id}.json`;
  const body = JSON.stringify(c, null, 2) + '\n';
  writeFileSync(join(ROOT, file), body);
  if (c.split === 'eval') manifest.push({ file, sha256: createHash('sha256').update(body).digest('hex') });
  for (const p of c.gold.pairs) counts[`${c.split}:${p.plant}:${p.class}`] = (counts[`${c.split}:${p.plant}:${p.class}`] ?? 0) + 1;
}
manifest.sort((a, b) => a.file.localeCompare(b.file));
const setHash = createHash('sha256').update(manifest.map((m) => `${m.sha256}  ${m.file}\n`).join('')).digest('hex');
writeFileSync(join(ROOT, 'EVAL_MANIFEST.json'), JSON.stringify({ benchmark: 'decision-evidence-v1', seed: SEED, eval_cases: manifest.length, eval_set_sha256: setHash, algorithm: 'sha256 over lines "<file sha256>  <path>\\n", sorted by path', files: manifest }, null, 2) + '\n');
writeFileSync(join(ROOT, 'PLANT_COUNTS.json'), JSON.stringify(Object.fromEntries(Object.entries(counts).sort()), null, 2) + '\n');
console.log('dev', readdirSync(join(ROOT, 'cases/dev')).length, 'eval', readdirSync(join(ROOT, 'cases/eval')).length, 'eval_set_sha256', setHash);
