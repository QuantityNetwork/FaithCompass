export interface Money {
  amount: number;
  currency: "USD";
}

/** Convert integer cents into a Money object in major units. */
export function usd(cents: number): Money {
  return { amount: Math.round(cents) / 100, currency: "USD" };
}

export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function formatUsd(cents: number, options: { precise?: boolean } = {}): string {
  const precise = options.precise ?? cents % 100 !== 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: precise ? 2 : 0,
    maximumFractionDigits: precise ? 2 : 0,
  }).format(cents / 100);
}

export function sumCents(values: Iterable<number>): number {
  let total = 0;
  for (const v of values) total += v;
  return total;
}
