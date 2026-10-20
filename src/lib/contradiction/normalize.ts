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
}

const MONTHS: Record<string, string> = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };

const clean = (s: string | null | undefined) => (s ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ');

export function normalizeEntity(s: string | null | undefined): string | null {
  const t = clean(s).toLowerCase().replace(/[.,]/g, '').replace(/\b(inc|incorporated|ltd|limited|llc|plc|ab|gmbh|corp|corporation|co)\b/g, '').replace(/\s+/g, ' ').trim();
  return t || null;
}

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

export function normalizeUnit(s: string | null | undefined): { unit: string | null; dimension: string | null; factor: number } {
  const t = clean(s).toLowerCase().replace(/[\s.]/g, '');
  if (!t) return { unit: null, dimension: null, factor: 1 };
  const u = UNITS[t];
  return u ? { unit: u.canonical, dimension: u.dimension, factor: u.factor } : { unit: t.toUpperCase(), dimension: t.toUpperCase(), factor: 1 };
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
      entity: normalizeEntity(f.entity),
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
