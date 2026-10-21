/**
 * Context normalisation for the deterministic contradiction layer. Two statements can only contradict each other
 * if they are about the same thing: same entity, concept, period, unit, basis, definition, version, effective date
 * and scope. Each dimension is normalised by fixed, documented rules; nothing is inferred by a model.
 */
export interface Fact {
  /** Stable reference, e.g. an SDEP EvidenceSpan id. */
  id: string;
  entity: string;
  /** What is measured or stated (e.g. "total_debt", "ebitda"). */
  concept: string;
  value: number | string | boolean | null;
  unit?: string | null;
  period?: string | null;
  basis?: string | null;
  definition?: string | null;
  version?: string | null;
  effectiveDate?: string | null;
  scope?: string | null;
  /** Statements in one group are mutually exclusive options (e.g. "renews" / "does not renew"). */
  exclusiveGroup?: string | null;
  /** How the document hedges the value, verbatim (e.g. "approximately"). An approximation widens the tolerance. */
  qualifier?: string | null;
}

export const DIMENSIONS = ['entity', 'concept', 'period', 'unit', 'basis', 'definition', 'version', 'effectiveDate', 'scope'] as const;
export type Dimension = (typeof DIMENSIONS)[number];

export interface NormalizedFact {
  id: string;
  context: Record<Dimension, string | null>;
  value: number | string | boolean | null;
  /** Numeric value expressed in the canonical unit (e.g. USD millions), or null for non-numeric values. */
  canonicalValue: number | null;
  /** Unit dimension: money, percent, ratio, count, text, or the normalised unit if unknown. */
  dimension: string | null;
  exclusiveGroup: string | null;
  /** Canonical legal form of the entity (LTD, AB, INC, …) or null when none is written. */
  legalForm: string | null;
  /** True when the value is stated as an approximation. */
  approximate: boolean;
}

const MONTHS: Record<string, string> = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };

const clean = (s: string | null | undefined) => (s ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ');

export function normalizeEntity(s: string | null | undefined): string | null {
  const t = clean(s).toLowerCase().replace(/[.,]/g, '').replace(/\b(inc|incorporated|ltd|limited|llc|plc|ab|gmbh|corp|corporation|co)\b/g, '').replace(/\s+/g, ' ').trim();
  return t || null;
}

/**
 * Legal forms, canonicalised. Spelling variants of one form are the same form ("Ltd" = "Limited"); two different
 * forms of one name ("Tamsin AB", "Tamsin Ltd") are two legal entities. Only a trailing token counts as a form.
 */
const LEGAL_FORMS: Record<string, string> = {
  ltd: 'LTD', limited: 'LTD', inc: 'INC', incorporated: 'INC', llc: 'LLC', plc: 'PLC', ab: 'AB', publ: 'AB', gmbh: 'GMBH',
  corp: 'CORP', corporation: 'CORP', oy: 'OY', oyj: 'OYJ', asa: 'ASA', as: 'AS', aps: 'APS', ag: 'AG', sa: 'SA', nv: 'NV', bv: 'BV', spa: 'SPA', srl: 'SRL', sarl: 'SARL', lp: 'LP', llp: 'LLP',
};

export function legalFormOf(s: string | null | undefined): string | null {
  const words = clean(s).toLowerCase().replace(/[.,()]/g, ' ').trim().split(/\s+/);
  if (words.length < 2) return null;
  const last = words[words.length - 1];
  return LEGAL_FORMS[last] ?? null;
}

/** Entity name without its legal form, for comparison together with `legalFormOf`. */
function entityBase(s: string | null | undefined): string | null {
  const form = legalFormOf(s);
  const t = clean(s).replace(/[.,()]/g, ' ').trim().replace(/\s+/g, ' ');
  return normalizeEntity(form ? t.split(' ').slice(0, -1).join(' ') : t);
}

/** Hedging words that mark a value as approximate. */
export const APPROXIMATION = /\b(approx(imately)?|about|around|circa|roughly|some|c\.|~)/i;

export function normalizeConcept(s: string | null | undefined): string | null {
  const t = clean(s).toLowerCase().replace(/[\s-]+/g, '_');
  return t || null;
}

/** ISO date (YYYY-MM-DD) from "30 Jun 2026", "2026-06-30", "June 30, 2026"; null if unknown. */
export function normalizeDate(s: string | null | undefined): string | null {
  const t = clean(s).toLowerCase();
  if (!t) return null;
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{1,2}) ([a-z]{3})[a-z]* (\d{4})$/);
  if (m && MONTHS[m[2]]) return `${m[3]}-${MONTHS[m[2]]}-${m[1].padStart(2, '0')}`;
  m = t.match(/^([a-z]{3})[a-z]* (\d{1,2}),? (\d{4})$/);
  if (m && MONTHS[m[1]]) return `${m[3]}-${MONTHS[m[1]]}-${m[2].padStart(2, '0')}`;
  return t;
}

/** "FY 2025" / "fy2025" / "2025 FY" → "FY2025"; "LTM to 30 Jun 2026" → "LTM:2026-06-30"; "Q1 2027" → "2027-Q1". */
export function normalizePeriod(s: string | null | undefined): string | null {
  const t = clean(s).toLowerCase();
  if (!t) return null;
  let m = t.match(/^fy ?(\d{4})$|^(\d{4}) ?fy$/);
  if (m) return `FY${m[1] ?? m[2]}`;
  m = t.match(/^(?:ltm|ttm)(?: to| ending)? (.+)$/);
  if (m) return `LTM:${normalizeDate(m[1])}`;
  m = t.match(/^q([1-4]) ?(\d{4})$|^(\d{4})[ -]?q([1-4])$/);
  if (m) return m[1] ? `${m[2]}-Q${m[1]}` : `${m[3]}-Q${m[4]}`;
  return t.replace(/\s+/g, '_').toUpperCase();
}

const UNITS: Record<string, { dimension: string; canonical: string; factor: number }> = {
  '$': { dimension: 'money:USD', canonical: 'USD_M', factor: 1e-6 },
  usd: { dimension: 'money:USD', canonical: 'USD_M', factor: 1e-6 },
  '$k': { dimension: 'money:USD', canonical: 'USD_M', factor: 1e-3 },
  usdk: { dimension: 'money:USD', canonical: 'USD_M', factor: 1e-3 },
  '$m': { dimension: 'money:USD', canonical: 'USD_M', factor: 1 },
  usdm: { dimension: 'money:USD', canonical: 'USD_M', factor: 1 },
  '$mm': { dimension: 'money:USD', canonical: 'USD_M', factor: 1 },
  '$millions': { dimension: 'money:USD', canonical: 'USD_M', factor: 1 },
  usdmillions: { dimension: 'money:USD', canonical: 'USD_M', factor: 1 },
  '$b': { dimension: 'money:USD', canonical: 'USD_M', factor: 1e3 },
  usdbn: { dimension: 'money:USD', canonical: 'USD_M', factor: 1e3 },
  '%': { dimension: 'percent', canonical: 'PCT', factor: 1 },
  pct: { dimension: 'percent', canonical: 'PCT', factor: 1 },
  percent: { dimension: 'percent', canonical: 'PCT', factor: 1 },
  bp: { dimension: 'percent', canonical: 'PCT', factor: 0.01 },
  x: { dimension: 'ratio', canonical: 'X', factor: 1 },
  times: { dimension: 'ratio', canonical: 'X', factor: 1 },
  text: { dimension: 'text', canonical: 'TEXT', factor: 1 },
};

/** Currency symbols and ISO codes read by `moneyUnit`; amounts are canonicalised to millions of that currency. */
const CURRENCIES: Record<string, string> = { $: 'USD', usd: 'USD', '€': 'EUR', eur: 'EUR', '£': 'GBP', gbp: 'GBP', sek: 'SEK', nok: 'NOK', dkk: 'DKK', chf: 'CHF' };
const SCALES: Record<string, number> = { '': 1e-6, k: 1e-3, thousand: 1e-3, thousands: 1e-3, "'000": 1e-3, m: 1, mn: 1, mm: 1, million: 1, millions: 1, b: 1e3, bn: 1e3, billion: 1e3, billions: 1e3 };

/** "USD million", "EUR m", "SEKm", "€bn", "GBP thousand" → currency, canonical unit and factor to millions. */
function moneyUnit(t: string): { unit: string; dimension: string; factor: number } | null {
  const CCY = '(\\$|usd|€|eur|£|gbp|sek|nok|dkk|chf)';
  const pre = t.match(new RegExp(`^${CCY}(.*)$`));
  const post = pre ? null : t.match(new RegExp(`^(.*?)${CCY}$`));
  const [ccy, scale] = pre ? [pre[1], pre[2]] : post ? [post[2], post[1]] : [null, null];
  if (ccy === null || scale === null || !(scale in SCALES)) return null;
  return { unit: `${CURRENCIES[ccy]}_M`, dimension: `money:${CURRENCIES[ccy]}`, factor: SCALES[scale] };
}

export function normalizeUnit(s: string | null | undefined): { unit: string | null; dimension: string | null; factor: number } {
  const t = clean(s).toLowerCase().replace(/[\s.]/g, '');
  if (!t) return { unit: null, dimension: null, factor: 1 };
  const u = UNITS[t];
  if (u) return { unit: u.canonical, dimension: u.dimension, factor: u.factor };
  const money = moneyUnit(t);
  return money ?? { unit: t.toUpperCase(), dimension: t.toUpperCase(), factor: 1 };
}

/** Basis/definition: case-folded, whitespace collapsed; a parenthetical qualifier is kept (it often is the difference). */
export function normalizeText(s: string | null | undefined): string | null {
  const t = clean(s).toLowerCase();
  return t || null;
}

export function normalizeFact(f: Fact): NormalizedFact {
  const u = normalizeUnit(f.unit);
  const numeric = typeof f.value === 'number' && Number.isFinite(f.value);
  return {
    id: f.id,
    context: {
      entity: entityBase(f.entity),
      concept: normalizeConcept(f.concept),
      period: normalizePeriod(f.period),
      unit: u.unit,
      basis: normalizeText(f.basis),
      definition: normalizeText(f.definition),
      version: normalizeText(f.version),
      effectiveDate: normalizeDate(f.effectiveDate),
      scope: normalizeText(f.scope),
    },
    value: f.value,
    canonicalValue: numeric ? Math.round((f.value as number) * u.factor * 1e9) / 1e9 : null,
    dimension: u.dimension,
    exclusiveGroup: normalizeConcept(f.exclusiveGroup),
    legalForm: legalFormOf(f.entity),
    approximate: APPROXIMATION.test(f.qualifier ?? ''),
  };
}

/**
 * Calendar range of a normalised period, or null if it cannot be placed. Fiscal years are read as calendar years
 * (an explicit assumption: no fiscal year-end is recorded); LTM ends on its date and covers the 12 months before.
 */
export function periodRange(p: string | null): [string, string] | null {
  if (!p) return null;
  let m = p.match(/^FY(\d{4})$/);
  if (m) return [`${m[1]}-01-01`, `${m[1]}-12-31`];
  m = p.match(/^(\d{4})-Q([1-4])$/);
  if (m) {
    const q = Number(m[2]);
    const end = ['03-31', '06-30', '09-30', '12-31'][q - 1];
    return [`${m[1]}-${String(q * 3 - 2).padStart(2, '0')}-01`, `${m[1]}-${end}`];
  }
  m = p.match(/^LTM:(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const start = new Date(Date.UTC(Number(m[1]) - 1, Number(m[2]) - 1, Number(m[3]) + 1)).toISOString().slice(0, 10);
    return [start, `${m[1]}-${m[2]}-${m[3]}`];
  }
  return null;
}

export function periodsDisjoint(a: string | null, b: string | null): boolean {
  const ra = periodRange(a);
  const rb = periodRange(b);
  return !!ra && !!rb && (ra[1] < rb[0] || rb[1] < ra[0]);
}
