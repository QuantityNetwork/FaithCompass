import type { AccountTransactionRow, Frequency, ISODate } from "../entities";
import { addMonths, daysBetween } from "../dates";

export interface DetectedSeries {
  counterparty: string;
  occurrences: number;
  frequency: Frequency;
  typical_amount_cents: number;
  amount_variance_percent: number;
  last_posted_on: ISODate;
  next_expected_on: ISODate;
  account_id: string;
  confidence: "high" | "medium";
}

const INTERVALS: { frequency: Frequency; days: number; tolerance: number }[] = [
  { frequency: "monthly", days: 30, tolerance: 5 },
  { frequency: "quarterly", days: 91, tolerance: 10 },
  { frequency: "semiannual", days: 182, tolerance: 14 },
  { frequency: "annual", days: 365, tolerance: 20 },
];

function normalizeCounterparty(tx: AccountTransactionRow): string {
  return (tx.counterparty ?? tx.description).trim().toLowerCase().replace(/\s+#?\d+$/, "");
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

/**
 * Detect recurring outflows. A series requires at least three posted debits
 * to the same counterparty at a regular interval with stable amounts.
 */
export function detectRecurringSeries(transactions: AccountTransactionRow[]): DetectedSeries[] {
  const groups = new Map<string, AccountTransactionRow[]>();
  for (const tx of transactions) {
    if (tx.status !== "posted" || tx.amount_cents >= 0) continue;
    const key = `${tx.account_id}::${normalizeCounterparty(tx)}`;
    const list = groups.get(key) ?? [];
    list.push(tx);
    groups.set(key, list);
  }

  const series: DetectedSeries[] = [];
  for (const list of groups.values()) {
    if (list.length < 3) continue;
    list.sort((a, b) => a.posted_on.localeCompare(b.posted_on));
    const gaps = list.slice(1).map((tx, i) => daysBetween(list[i]!.posted_on, tx.posted_on));
    const typicalGap = median(gaps);
    const interval = INTERVALS.find((iv) => Math.abs(typicalGap - iv.days) <= iv.tolerance);
    if (!interval) continue;
    const regular = gaps.every((g) => Math.abs(g - interval.days) <= interval.tolerance);
    const amounts = list.map((tx) => Math.abs(tx.amount_cents));
    const typical = median(amounts);
    const maxDeviation = Math.max(...amounts.map((a) => Math.abs(a - typical)));
    const variance = typical === 0 ? 0 : Math.round((maxDeviation / typical) * 1000) / 10;
    if (variance > 35) continue;
    const last = list[list.length - 1]!;
    const monthsStep = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 }[interval.frequency];
    series.push({
      counterparty: last.counterparty ?? last.description,
      occurrences: list.length,
      frequency: interval.frequency,
      typical_amount_cents: typical,
      amount_variance_percent: variance,
      last_posted_on: last.posted_on,
      next_expected_on: addMonths(last.posted_on, monthsStep),
      account_id: last.account_id,
      confidence: regular && variance <= 10 ? "high" : "medium",
    });
  }
  return series.sort((a, b) => b.typical_amount_cents - a.typical_amount_cents);
}
