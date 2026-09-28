import type { ISODate } from "./entities";

const DAY_MS = 86_400_000;

export function toISODate(date: Date): ISODate {
  return date.toISOString().slice(0, 10);
}

export function parseISODate(value: ISODate): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function addDays(date: ISODate, days: number): ISODate {
  return toISODate(new Date(parseISODate(date).getTime() + days * DAY_MS));
}

export function addMonths(date: ISODate, months: number): ISODate {
  const d = parseISODate(date);
  const day = d.getUTCDate();
  const result = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return toISODate(result);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: ISODate, to: ISODate): number {
  return Math.round((parseISODate(to).getTime() - parseISODate(from).getTime()) / DAY_MS);
}

export function daysInYear(year: number): number {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;
}

export function endOfMonth(date: ISODate): ISODate {
  const d = parseISODate(date);
  return toISODate(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)));
}

export function dayOfYear(date: ISODate): number {
  const d = parseISODate(date);
  return daysBetween(`${d.getUTCFullYear()}-01-01`, date) + 1;
}

export function minDate(a: ISODate, b: ISODate): ISODate {
  return a < b ? a : b;
}
