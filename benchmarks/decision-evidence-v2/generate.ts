/**
 * Generator for benchmarks/decision-evidence-v2: 36 FICTIONAL held-out cases (9 private credit, 9 M&A, 9 contract,
 * 9 scholarly), all eval. Authored test material: every entity, document, number and quotation is invented; nothing
 * describes a real company, contract, manuscript or person, and none of it is client data.
 *
 * Written after the v2 pre-registration (PREREGISTRATION.md, commit 7c301d5) and before any system ran on v2. Fresh
 * names, document titles, measures, sentence templates and currencies; plants carry over the v1 controls and add new
 * surface forms of every v1 failure mode (README.md §Gold), including plants aimed at the rules added after v1
 * (e.g. an approximation far outside 5%, "Ltd"/"Limited" as one entity, a currency outside the unit table, part-year
 * periods the veto cannot read).
 *
 * Deterministic: seed 20261121. Run: npx tsx benchmarks/decision-evidence-v2/generate.ts (refuses to overwrite a frozen set).
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'benchmarks/decision-evidence-v2');
const SEED = 20261121;

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
  version?: string | null;
  effectiveDate?: string | null;
  exclusiveGroup?: string | null;
  shown?: string;
  qualifier?: string;
}
interface Plant { type: string; gold: Gold; a: Stmt; b: Stmt; note: string }

interface Quantity { concept: string; label: string; synonym: [string, string]; base: [number, number]; unit: string; flow: boolean }
interface TextTerm { concept: string; label: string; readings: [string, string] }
interface Choice { group: string; label: string; options: [string, string] }
interface Domain { key: string; prefix: string; names: string[]; role: string; docTitles: [string, string, string]; money: { unit: string; word: string; code: string }; quantities: Quantity[]; texts: TextTerm[]; choices: Choice[]; decision: string }

const NAMES = ['Aldermoor', 'Brennick', 'Castellan', 'Dunmere', 'Ferrovane', 'Galloway Reach', 'Hollins', 'Ivarsen', 'Juniper Cove', 'Kalvik', 'Larkspur', 'Mossgiel', 'Nordvik', 'Oakhurst', 'Pennant', 'Rookwood', 'Stavenes', 'Thornbury'];
const SUFFIX = ['Capital', 'Logistics', 'Foods', 'Energy', 'Software', 'Healthcare'];
const BRANDS = ['Bluefin', 'Northstar', 'Copperline', 'Greywater', 'Saltmarsh', 'Ridgeway', 'Fernhill', 'Lumen'];

const DOMAINS: Domain[] = [
  {
    key: 'private_credit', prefix: 'pc', names: NAMES, role: 'the Borrower',
    docTitles: ['Annual report extract', 'Quarterly lender update', 'Independent business review'],
    money: { unit: '$m', word: 'USD million', code: 'USD' },
    quantities: [
      { concept: 'senior_leverage', label: 'senior leverage', synonym: ['senior_leverage', 'senior_net_leverage_multiple'], base: [2, 6], unit: 'x', flow: false },
      { concept: 'free_cash_flow', label: 'free cash flow', synonym: ['free_cash_flow', 'unlevered_cash_generation'], base: [8, 70], unit: 'money', flow: true },
      { concept: 'gross_debt', label: 'gross debt', synonym: ['gross_debt', 'total_borrowings'], base: [90, 500], unit: 'money', flow: false },
      { concept: 'dscr', label: 'debt service cover ratio', synonym: ['dscr', 'debt_service_coverage'], base: [1.1, 3], unit: 'x', flow: false },
      { concept: 'recurring_revenue_share', label: 'recurring revenue share', synonym: ['recurring_revenue_share', 'contracted_revenue_ratio'], base: [40, 90], unit: '%', flow: false },
      { concept: 'cash_balance', label: 'cash on balance sheet', synonym: ['cash_balance', 'unrestricted_cash'], base: [5, 80], unit: 'money', flow: false },
      { concept: 'opex', label: 'operating expenses', synonym: ['opex', 'operating_costs'], base: [40, 300], unit: 'money', flow: true },
      { concept: 'arrears_rate', label: 'receivables in arrears', synonym: ['arrears_rate', 'overdue_receivables_share'], base: [1, 12], unit: '%', flow: false },
    ],
    texts: [
      { concept: 'change_of_control', label: 'change of control definition', readings: ['triggered when the sponsor holds less than 50% of voting shares', 'triggered by any transfer of more than 30% of economic interest'] },
      { concept: 'cure_period', label: 'covenant cure mechanism', readings: ['cure by equity injection counted as EBITDA', 'cure by equity injection counted only as debt reduction'] },
    ],
    choices: [{ group: 'security_package', label: 'security package', options: ['first-lien security over all material subsidiaries', 'unsecured, ranking pari passu with trade creditors'] }],
    decision: 'the refinancing approval',
  },
  {
    key: 'm_and_a', prefix: 'ma', names: NAMES, role: 'the Target',
    docTitles: ['Vendor due diligence summary', 'Management presentation', 'Buyer quality-of-earnings memo'],
    money: { unit: '€m', word: 'EUR million', code: 'EUR' },
    quantities: [
      { concept: 'purchase_price', label: 'headline purchase price', synonym: ['purchase_price', 'equity_consideration'], base: [150, 1200], unit: 'money', flow: false },
      { concept: 'run_rate_ebitda', label: 'run-rate EBITDA', synonym: ['run_rate_ebitda', 'annualised_operating_profit'], base: [15, 120], unit: 'money', flow: true },
      { concept: 'net_retention', label: 'net revenue retention', synonym: ['net_retention', 'ndr'], base: [85, 130], unit: '%', flow: false },
      { concept: 'capex_intensity', label: 'capex as share of sales', synonym: ['capex_intensity', 'investment_ratio'], base: [2, 15], unit: '%', flow: false },
      { concept: 'synergies', label: 'cost synergies', synonym: ['synergies', 'integration_savings'], base: [5, 60], unit: 'money', flow: true },
      { concept: 'employees', label: 'employees', synonym: ['employees', 'staff_count'], base: [150, 4000], unit: 'count', flow: false },
      { concept: 'order_backlog', label: 'order backlog', synonym: ['order_backlog', 'contracted_pipeline'], base: [40, 600], unit: 'money', flow: false },
      { concept: 'pension_deficit', label: 'pension deficit', synonym: ['pension_deficit', 'unfunded_pension_liability'], base: [3, 90], unit: 'money', flow: false },
    ],
    texts: [
      { concept: 'warranty_scope', label: 'scope of the tax warranty', readings: ['covers periods up to completion only', 'covers periods up to completion and the following tax year'] },
      { concept: 'earnout_trigger', label: 'earn-out trigger', readings: ['measured on reported EBITDA', 'measured on EBITDA before integration costs'] },
    ],
    choices: [{ group: 'deal_structure', label: 'deal structure', options: ['share purchase of the whole group', 'asset purchase of the operating business only'] }],
    decision: 'the board recommendation to sign',
  },
  {
    key: 'contract', prefix: 'ct', names: NAMES, role: 'the Supplier',
    docTitles: ['Framework agreement', 'Change order', 'Procurement evaluation note'],
    money: { unit: 'SEK m', word: 'SEK million', code: 'SEK' },
    quantities: [
      { concept: 'contract_value', label: 'total contract value', synonym: ['contract_value', 'aggregate_order_value'], base: [20, 400], unit: 'money', flow: false },
      { concept: 'penalty_cap', label: 'delay penalty cap', synonym: ['penalty_cap', 'liquidated_damages_limit'], base: [3, 20], unit: '%', flow: false },
      { concept: 'payment_terms', label: 'payment terms', synonym: ['payment_terms', 'invoice_due_period'], base: [20, 90], unit: 'days', flow: false },
      { concept: 'response_time', label: 'incident response time', synonym: ['response_time', 'p1_reaction_window'], base: [1, 24], unit: 'hours', flow: false },
      { concept: 'volume_rebate', label: 'volume rebate', synonym: ['volume_rebate', 'tiered_discount'], base: [1, 9], unit: '%', flow: false },
      { concept: 'warranty_period', label: 'warranty period', synonym: ['warranty_period', 'defects_liability_period'], base: [6, 36], unit: 'months', flow: false },
      { concept: 'annual_charges', label: 'annual service charges', synonym: ['annual_charges', 'yearly_fees'], base: [2, 60], unit: 'money', flow: true },
      { concept: 'performance_bond', label: 'performance bond', synonym: ['performance_bond', 'bank_guarantee_amount'], base: [1, 30], unit: 'money', flow: false },
    ],
    texts: [
      { concept: 'ip_ownership', label: 'ownership of deliverables', readings: ['all deliverables vest in the customer on payment', 'the supplier keeps ownership and grants a perpetual licence'] },
      { concept: 'force_majeure', label: 'force majeure scope', readings: ['includes supplier labour disputes', 'excludes any labour dispute'] },
    ],
    choices: [{ group: 'exclusivity', label: 'exclusivity', options: ['the supplier is the exclusive provider for the term', 'the customer may appoint other providers at any time'] }],
    decision: 'the award recommendation',
  },
  {
    key: 'scholarly', prefix: 'sc', names: ['Codex Belmar', 'Wexcombe Psalter', 'Ardith Fragments', 'Lorne Chronicle', 'Book of Tavish', 'Sunder Roll', 'Elsing Gospels', 'Liber Morvan', 'Caddow Letters', 'Rilmoor Annals', 'Hesketh Breviary', 'Vauden Glosses'], role: 'the Manuscript',
    docTitles: ['Conservation report', 'Palaeographic study', 'Edition apparatus notes'],
    money: { unit: '$m', word: 'USD million', code: 'USD' },
    quantities: [
      { concept: 'leaf_height', label: 'leaf height', synonym: ['leaf_height', 'page_height'], base: [180, 420], unit: 'mm', flow: false },
      { concept: 'ruled_columns', label: 'ruled columns per page', synonym: ['ruled_columns', 'text_columns'], base: [1, 3], unit: 'count', flow: false },
      { concept: 'illuminated_initials', label: 'illuminated initials', synonym: ['illuminated_initials', 'decorated_capitals'], base: [10, 300], unit: 'count', flow: false },
      { concept: 'palimpsest_share', label: 'share of palimpsest leaves', synonym: ['palimpsest_share', 'reused_parchment_ratio'], base: [2, 40], unit: '%', flow: false },
      { concept: 'binding_date', label: 'binding date (CE)', synonym: ['binding_date', 'rebinding_year'], base: [1200, 1700], unit: 'year', flow: false },
      { concept: 'marginal_notes', label: 'marginal annotations', synonym: ['marginal_notes', 'marginalia'], base: [30, 900], unit: 'count', flow: false },
      { concept: 'missing_leaves', label: 'missing leaves', synonym: ['missing_leaves', 'lost_folios'], base: [2, 60], unit: 'count', flow: false },
      { concept: 'insurance_value', label: 'insured value', synonym: ['insurance_value', 'valuation_for_loan'], base: [0.5, 12], unit: 'money', flow: false },
    ],
    texts: [
      { concept: 'scribe_identity', label: 'identification of the main scribe', readings: ['the scribe of the sister manuscript at Elsing', 'an unidentified scribe trained in the same house'] },
      { concept: 'rubric_meaning', label: 'meaning of the rubric "de gradibus"', readings: ['a reference to the gradual psalms', 'a reference to ranks of the clergy'] },
    ],
    choices: [{ group: 'origin', label: 'place of production', options: ['produced at the cathedral scriptorium', 'produced in a lay urban workshop'] }],
    decision: 'the dating and attribution argument of the edition',
  },
];

/* ------------------------------------------------------------------- plants */

const QUANT_PLANTS = [
  'confirmed', 'basis', 'potential', 'missing',
  'alias_role', 'alias_brand', 'synonym_means', 'fye_march', 'unit_word_ccy', 'unit_word_unlisted', 'legal_form_variant', 'approx_far',
  'rounding_tight', 'unit_scale_bn', 'same_amount_other_wording', 'part_year', 'diff_year', 'restated', 'corrected', 'subsidiary', 'legal_entity_other', 'approx_near', 'effective_date',
] as const;
type QuantPlant = (typeof QUANT_PLANTS)[number];
const MONEY_PLANTS: QuantPlant[] = ['unit_word_ccy', 'unit_word_unlisted', 'unit_scale_bn', 'same_amount_other_wording'];

const isInt = (q: Quantity) => ['count', 'days', 'hours', 'months', 'year', 'mm'].includes(q.unit);
const valueFor = (q: Quantity) => (isInt(q) ? Math.round(q.base[0] + R() * (q.base[1] - q.base[0])) : round(q.base[0] + R() * (q.base[1] - q.base[0]), q.unit === 'x' ? 2 : 1));
const differ = (q: Quantity, v: number, lo = 0.1, span = 0.2) => {
  const step = isInt(q) ? Math.max(1, Math.round(v * (lo + R() * span))) : Math.max(round(v * (lo + R() * span), q.unit === 'x' ? 2 : 1), 0.1);
  return R() < 0.5 ? round(v + step, 2) : round(Math.max(v - step, step / 2), 2);
};

function quantPlant(type: QuantPlant, q: Quantity, d: Domain, entity: string, ctx: { role: string; brand: string; base: string }): Plant {
  const money = q.unit === 'money';
  const unit = money ? d.money.unit : q.unit;
  const v = valueFor(q);
  const w = differ(q, v);
  const period = pick(['FY2024', 'FY2025']);
  const base: Stmt = { entity, concept: q.concept, label: q.label, value: v, unit, period, basis: money ? 'reported' : null };
  const S = (o: Partial<Stmt>): Stmt => ({ ...base, ...o });
  const fallback = (t: QuantPlant) => quantPlant(t, q, d, entity, ctx);
  switch (type) {
    case 'confirmed': return { type, gold: 'CONFIRMED_CONFLICT', a: S({}), b: S({ value: w }), note: 'same entity, measure, period, unit and basis; values differ beyond rounding' };
    case 'basis': return { type, gold: 'DIFFERENT_REPORTING_BASIS', a: S({ basis: 'reported' }), b: S({ basis: 'pro forma (including the planned acquisition)', value: w }), note: 'the same measure stated on a different basis' };
    case 'potential': return { type, gold: 'POTENTIAL_CONFLICT', a: S({}), b: S({ period: null, value: w }), note: 'values differ; one statement gives no period' };
    case 'missing': return { type, gold: 'MISSING_EVIDENCE', a: S({}), b: S({ value: null, shown: 'to be confirmed; not included in this document' }), note: 'one document states a value, the other says it is not provided' };
    case 'alias_role': return { type, gold: 'CONFIRMED_CONFLICT', a: S({}), b: S({ entity: ctx.role, value: w }), note: `"${ctx.role}" is defined in the documents as ${entity}` };
    case 'alias_brand': return { type, gold: 'CONFIRMED_CONFLICT', a: S({}), b: S({ entity: ctx.brand, value: w }), note: `${entity} is stated to trade as "${ctx.brand}"` };
    case 'synonym_means': return { type, gold: 'CONFIRMED_CONFLICT', a: S({ concept: q.synonym[0], label: q.label }), b: S({ concept: q.synonym[1], label: q.synonym[1].replace(/_/g, ' '), value: w }), note: `"${q.synonym[1].replace(/_/g, ' ')}" is defined as the same measure as "${q.label}"` };
    case 'fye_march': return { type, gold: 'CONFIRMED_CONFLICT', a: S({ period: 'FY2025' }), b: S({ period: 'LTM to 31 Mar 2025', value: w }), note: 'the fiscal year ends 31 March (stated), so FY2025 and the twelve months to 31 March 2025 are the same period' };
    case 'unit_word_ccy':
      if (!money) return fallback('confirmed');
      return { type, gold: 'CONFIRMED_CONFLICT', a: S({}), b: S({ unit: d.money.word, value: w }), note: `"${d.money.word}" is the same unit as ${d.money.unit}` };
    case 'unit_word_unlisted':
      if (!money) return fallback('confirmed');
      return { type, gold: 'CONFIRMED_CONFLICT', a: S({ unit: 'NZD m' }), b: S({ unit: 'NZD million', value: w }), note: '"NZD million" and "NZD m" are the same unit (a currency outside the deterministic unit table)' };
    case 'legal_form_variant': return { type, gold: 'CONFIRMED_CONFLICT', a: S({ entity: `${ctx.base} Limited` }), b: S({ entity: `${ctx.base} Ltd`, value: w }), note: '"Ltd" abbreviates "Limited": one legal entity' };
    case 'approx_far':
      return { type, gold: 'CONFIRMED_CONFLICT', a: S({}), b: S({ value: isInt(q) ? Math.round(v * 1.25) : round(v * 1.25, v < 20 ? 1 : 0), qualifier: 'approximately' }), note: 'a stated approximation 25% away from the exact figure: not consistent' };
    case 'rounding_tight': return { type, gold: 'NONE', a: S({}), b: S({ value: isInt(q) ? Math.round(v * 1.003) : round(v * 1.003, 3) }), note: 'difference within rounding (0.3% or less)' };
    case 'unit_scale_bn':
      if (!money) return fallback('rounding_tight');
      return { type, gold: 'NONE', a: S({}), b: S({ unit: d.money.code === 'USD' ? '$k' : `${d.money.code} thousand`, value: Math.round(v * 1000) }), note: 'the same amount in thousands' };
    case 'same_amount_other_wording':
      if (!money) return fallback('rounding_tight');
      return { type, gold: 'NONE', a: S({}), b: S({ unit: d.money.word }), note: `the same amount, written with "${d.money.word}"` };
    case 'part_year':
      if (!q.flow) return fallback('diff_year');
      return { type, gold: 'NONE', a: S({ period: 'FY2025' }), b: S({ period: 'H1 2025', value: round(v * (0.42 + R() * 0.12), 1) }), note: 'a half-year figure and a full-year figure: different periods' };
    case 'diff_year': return { type, gold: 'NONE', a: S({ period: 'FY2023' }), b: S({ period: 'FY2025', value: w }), note: 'different fiscal years' };
    case 'restated': return { type, gold: 'NONE', a: S({ version: 'as originally reported' }), b: S({ version: 'as restated in the latest accounts', value: w }), note: 'a restatement replaces the original figure' };
    case 'corrected': return { type, gold: 'NONE', a: S({ version: 'first issue' }), b: S({ version: 'second issue (corrects the first issue)', value: w }), note: 'a corrected issue replaces the first' };
    case 'subsidiary': return { type, gold: 'NONE', a: S({}), b: S({ entity: `${ctx.base} Nordic, a subsidiary`, value: w }), note: 'a subsidiary, not the group' };
    case 'legal_entity_other': return { type, gold: 'NONE', a: S({ entity: `${ctx.base} Oy` }), b: S({ entity: `${ctx.base} GmbH`, value: w }), note: 'two different legal entities (Finnish Oy and German GmbH)' };
    case 'approx_near': return { type, gold: 'NONE', a: S({}), b: S({ value: isInt(q) ? Math.round(v * 0.975) : round(v * 0.975, v < 20 ? 1 : 0), qualifier: pick(['around', 'roughly', 'circa']) }), note: 'a stated approximation within 3% of the exact figure' };
    case 'effective_date': return { type, gold: 'NONE', a: S({ effectiveDate: '1 Jan 2025', period: null }), b: S({ effectiveDate: '1 Jul 2025', period: null, value: w }), note: 'two values effective from different dates: a change over time, not a conflict' };
  }
}

/** Construction checks: the gold reading of a numeric plant must hold for the numbers actually generated. */
function check(p: Plant) {
  if (typeof p.a.value !== 'number' || typeof p.b.value !== 'number') return;
  const rel = Math.abs(p.a.value - p.b.value) / Math.max(Math.abs(p.a.value), Math.abs(p.b.value));
  const ok = p.type === 'rounding_tight' ? rel <= 0.004 : p.type === 'approx_near' ? rel <= 0.035 : p.type === 'approx_far' ? rel >= 0.15 : ['confirmed', 'alias_role', 'alias_brand', 'synonym_means', 'fye_march', 'unit_word_ccy', 'unit_word_unlisted', 'legal_form_variant', 'basis', 'potential'].includes(p.type) ? rel >= 0.05 : true;
  if (!ok) throw new Error(`plant ${p.type} violates its gold reading: ${p.a.value} vs ${p.b.value}`);
}

const textPlant = (t: TextTerm, entity: string): Plant => ({ type: 'interpretation', gold: 'UNRESOLVED_INTERPRETATION', a: { entity, concept: t.concept, label: t.label, value: t.readings[0], unit: 'text' }, b: { entity, concept: t.concept, label: t.label, value: t.readings[1], unit: 'text' }, note: 'two readings of one term' });
const choicePlant = (c: Choice, entity: string): Plant => ({ type: 'exclusive', gold: 'CONFIRMED_CONFLICT', a: { entity, concept: `${c.group}_a`, label: c.label, value: true, exclusiveGroup: c.group, shown: c.options[0] }, b: { entity, concept: `${c.group}_b`, label: c.label, value: false, exclusiveGroup: c.group, shown: c.options[1] }, note: 'mutually exclusive options both asserted' });

/* ---------------------------------------------------------------- sentences */

const fmt = (v: number, unit: string) => {
  const n = String(v);
  switch (unit) {
    case '$m': return `$${n}m`;
    case '$k': return `$${n}k`;
    case '€m': return `€${n}m`;
    case 'SEK m': return `SEK ${n}m`;
    case 'NZD m': return `NZD ${n}m`;
    case '%': return `${n}%`;
    case 'x': return `${n}x`;
    case 'count': return n;
    case 'year': return n;
    default:
      if (/ (million|thousand)$/.test(unit)) { const [code, scale] = unit.split(' '); return `${code} ${n} ${scale}`; }
      return `${n} ${unit}`;
  }
};

function sentence(s: Stmt, k: number): string {
  if (s.exclusiveGroup) return `As to ${s.entity}, the ${s.label} is: ${s.shown}.`;
  if (s.unit === 'text') return `The ${s.label} for ${s.entity} is understood as follows: ${s.value}.`;
  const when = s.period ? (s.period.startsWith('LTM') ? `in the ${s.period.replace('LTM to', 'twelve months to')}` : `in ${s.period}`) : '';
  const eff = s.effectiveDate ? `with effect from ${s.effectiveDate}` : '';
  const basis = s.basis ? `(${s.basis} basis)` : '';
  const ver = s.version ? `, ${s.version}` : '';
  if (s.value === null) return `${s.label[0].toUpperCase()}${s.label.slice(1)} of ${s.entity} ${when}: ${s.shown}.`.replace(/\s+/g, ' ');
  const val = `${s.qualifier ? s.qualifier + ' ' : ''}${fmt(s.value as number, s.unit ?? '')}`;
  const forms = [
    `${s.entity} had ${s.label} of ${val} ${when} ${eff} ${basis}${ver}.`,
    `For ${s.entity}, ${s.label} ${when} ${eff} was ${val} ${basis}${ver}.`,
    `${s.label[0].toUpperCase()}${s.label.slice(1)} at ${s.entity} stood at ${val} ${when} ${eff} ${basis}${ver}.`,
  ];
  return forms[k % 3].replace(/\s+/g, ' ').replace(/ ([.,])/g, '$1');
}

/* -------------------------------------------------------------------- cases */

function buildCase(d: Domain, i: number) {
  const name = d.names[(i * 5 + 2) % d.names.length];
  const entity = d.key === 'scholarly' ? name : `${name} ${pick(SUFFIX)}`;
  const baseName = entity.split(' ')[0];
  const ctx = { role: d.role, brand: pick(BRANDS), base: baseName };
  const qs = [...d.quantities];
  for (let k = qs.length - 1; k > 0; k--) {
    const j = Math.floor(R() * (k + 1));
    [qs[k], qs[j]] = [qs[j], qs[k]];
  }
  const types: QuantPlant[] = [];
  for (let k = 0; k < 6; k++) types.push(QUANT_PLANTS[(i * 6 + k + d.prefix.charCodeAt(0) * 3) % QUANT_PLANTS.length]);
  // Give each plant a quantity it can use (money plants need a money measure, part_year a flow measure).
  const needs = (t: QuantPlant, q: Quantity) => (MONEY_PLANTS.includes(t) ? q.unit === 'money' : t === 'part_year' ? q.flow : true);
  const chosen: Quantity[] = [];
  for (const t of types) {
    const j = qs.findIndex((q) => needs(t, q));
    chosen.push(qs.splice(j >= 0 ? j : 0, 1)[0]);
  }
  const plants: Plant[] = chosen.map((q, k) => quantPlant(types[k], q, d, entity, ctx));
  plants.forEach(check);
  if (i % 2 === 1) plants.push(textPlant(d.texts[((i - 1) / 2) % d.texts.length], entity));
  if (i % 3 === 1) plants.push(choicePlant(d.choices[0], entity));

  const docs = d.docTitles.map((t, k) => ({ id: `D${k + 1}`, title: t, sentences: [] as { stmt: Stmt; plant: number; side: 'a' | 'b' }[] }));
  plants.forEach((p, k) => {
    const da = (k + i) % 3;
    const db = (da + 1 + ((k + i) % 2)) % 3;
    docs[da].sentences.push({ stmt: p.a, plant: k, side: 'a' });
    docs[db].sentences.push({ stmt: p.b, plant: k, side: 'b' });
  });
  const spans: { id: string; doc: string; start: number; end: number; text: string }[] = [];
  const facts: Record<string, unknown>[] = [];
  const ids: Record<string, string> = {};
  const preamble: Record<string, string[]> = { D1: [], D2: [], D3: [] };
  if (plants.some((p) => p.type === 'alias_role')) preamble.D1.push(`Throughout the documents of this review, ${d.role} means ${entity}.`);
  if (plants.some((p) => p.type === 'alias_brand')) preamble.D2.push(`${entity} trades under the name ${ctx.brand}.`);
  if (plants.some((p) => p.type === 'fye_march')) preamble.D3.push(`${entity} has a financial year ending on 31 March; FY2025 is the year ended 31 March 2025.`);
  const documents = docs.map((doc) => {
    let text = `${doc.title}: ${entity} (fictional, authored test material).\n${preamble[doc.id].join(' ')}${preamble[doc.id].length ? ' ' : ''}`;
    doc.sentences.forEach((s, n) => {
      const sent = sentence(s.stmt, n + i);
      const id = `${doc.id}#s${n + 1}`;
      const start = text.length;
      text += sent + ' ';
      spans.push({ id, doc: doc.id, start, end: start + sent.length, text: sent });
      ids[`${s.plant}${s.side}`] = id;
      const { label, shown, qualifier, ...fact } = s.stmt;
      void label; void shown;
      facts.push({ id, ...fact, ...(qualifier ? { qualifier } : {}) });
    });
    return { id: doc.id, title: doc.title, text: text.trim() };
  });
  const syn = plants.filter((p) => p.type === 'synonym_means');
  if (syn.length) documents[1].text += ' ' + syn.map((p) => `Throughout the documents of this review, "${p.b.label}" means the same measure as ${p.a.label}.`).join(' ');

  const pairs = plants.map((p, k) => ({ facts: [ids[`${k}a`], ids[`${k}b`]] as [string, string], class: p.gold, plant: p.type, note: p.note }));
  // Conclusion inputs: quantity plants about this entity's figure for one period. Excluded: legal_entity_other,
  // diff_year, part_year, effective_date (two different facts, neither is "the" input). Acceptable evidence:
  // restated / corrected → the replacing statement only; subsidiary → the group statement only; otherwise either.
  const usable = plants.slice(0, 6).map((p, k) => ({ p, k })).filter(({ p }) => !['legal_entity_other', 'diff_year', 'part_year', 'effective_date'].includes(p.type));
  const accept = ({ p, k }: { p: Plant; k: number }) => (p.type === 'restated' || p.type === 'corrected' ? [ids[`${k}b`]] : p.type === 'subsidiary' ? [ids[`${k}a`]] : [ids[`${k}a`], ids[`${k}b`]]);
  const groups = [usable.slice(0, 2), usable.slice(2, 4)].filter((g) => g.length);
  const conclusions = groups.map((g, k) => ({ id: `C${k + 1}`, text: `${g.map(({ p }) => p.a.label[0].toUpperCase() + p.a.label.slice(1)).join(' and ')} of ${entity} ${g.length > 1 ? 'are' : 'is'} adequate for ${d.decision}` }));
  const inputs = Object.fromEntries(conclusions.map((c, k) => [c.id, groups[k].map((u) => ({ input: u.p.a.label, acceptable: accept(u).sort() }))]));
  const dependencies = Object.fromEntries(conclusions.map((c, k) => [c.id, groups[k].flatMap(accept).sort()]));
  return { id: `${d.prefix}-${String(i + 1).padStart(2, '0')}`, domain: d.key, split: 'eval' as const, fictional: true as const, authored_test_material: true, title: `${entity}: ${d.key.replace(/_/g, ' ')} review (fictional)`, entity, documents, spans, facts, conclusions, gold: { pairs, inputs, dependencies } };
}

if (existsSync(join(ROOT, 'EVAL_MANIFEST.json')) && !process.argv.includes('--force')) throw new Error('v2 eval set is frozen (EVAL_MANIFEST.json exists); refusing to overwrite');
mkdirSync(join(ROOT, 'cases/eval'), { recursive: true });
const manifest: { file: string; sha256: string }[] = [];
const counts: Record<string, number> = {};
for (const d of DOMAINS) for (let i = 0; i < 9; i++) {
  const c = buildCase(d, i);
  const file = `cases/eval/${c.id}.json`;
  const body = JSON.stringify(c, null, 2) + '\n';
  writeFileSync(join(ROOT, file), body);
  manifest.push({ file, sha256: createHash('sha256').update(body).digest('hex') });
  for (const p of c.gold.pairs) counts[`${p.plant}:${p.class}`] = (counts[`${p.plant}:${p.class}`] ?? 0) + 1;
}
manifest.sort((a, b) => a.file.localeCompare(b.file));
const setHash = createHash('sha256').update(manifest.map((m) => `${m.sha256}  ${m.file}\n`).join('')).digest('hex');
writeFileSync(join(ROOT, 'EVAL_MANIFEST.json'), JSON.stringify({ benchmark: 'decision-evidence-v2', seed: SEED, eval_cases: manifest.length, eval_set_sha256: setHash, algorithm: 'sha256 over lines "<file sha256>  <path>\\n", sorted by path', files: manifest }, null, 2) + '\n');
writeFileSync(join(ROOT, 'PLANT_COUNTS.json'), JSON.stringify(Object.fromEntries(Object.entries(counts).sort()), null, 2) + '\n');
console.log('eval', manifest.length, 'eval_set_sha256', setHash);
