import type { Frequency, ISODate } from "../entities";
import { addMonths } from "../dates";

export const FREQUENCY_MONTHS: Record<Frequency, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
};

export function monthlyEquivalentCents(amountCents: number, frequency: Frequency): number {
  return Math.round(amountCents / FREQUENCY_MONTHS[frequency]);
}

export function annualEquivalentCents(amountCents: number, frequency: Frequency): number {
  return Math.round(amountCents * (12 / FREQUENCY_MONTHS[frequency]));
}

/** Due dates of a recurring obligation within [from, to], starting at `nextDue`. */
export function projectDueDates(nextDue: ISODate | null, frequency: Frequency, from: ISODate, to: ISODate): ISODate[] {
  if (!nextDue) return [];
  const step = FREQUENCY_MONTHS[frequency];
  const dates: ISODate[] = [];
  let current = nextDue;
  // Walk forward to the window, bounded to avoid runaway loops on bad data.
  for (let i = 0; i < 240 && current < from; i++) current = addMonths(current, step);
  for (let i = 0; i < 240 && current <= to; i++) {
    dates.push(current);
    current = addMonths(current, step);
  }
  return dates;
}

/** Default annual maintenance reserve: 1% of property value. */
export function maintenanceReserveMonthlyCents(valueCents: number, percent = 1): number {
  return Math.round((valueCents * (percent / 100)) / 12);
}
