import type { AccountRow, PropertyRow, TransactionRow } from "@/domain/entities";
import { usd, type Money } from "@/domain/money";
import type { NormalizedAccount } from "@/server/integrations/financial/types";

export const money = (cents: number): Money => usd(cents);
export const moneyOrNull = (cents: number | null | undefined): Money | null => (cents == null ? null : usd(cents));

export function formatAddress(p: Pick<PropertyRow, "address_line1" | "address_line2" | "city" | "region" | "postal_code">): string {
  return [p.address_line1, p.address_line2, `${p.city}, ${p.region} ${p.postal_code}`].filter(Boolean).join(", ");
}

export function shortAddress(p: Pick<PropertyRow, "address_line1" | "city" | "region">): string {
  return `${p.address_line1}, ${p.city}, ${p.region}`;
}

export function propertyRef(p: PropertyRow) {
  return { property_id: p.id, reference: p.reference, address: formatAddress(p), status: p.status };
}

export function transactionRef(t: TransactionRow) {
  return { transaction_id: t.id, reference: t.reference, closing_date: t.closing_date };
}

export function propertyLabel(p: PropertyRow): string {
  return `Property #${p.reference} (${shortAddress(p)})`;
}

export function accountRef(a: NormalizedAccount | (AccountRow & { institution?: string })) {
  return {
    account_id: a.id,
    institution: "institution" in a && a.institution ? a.institution : "Connected institution",
    name: a.name,
    mask: `••${a.mask}`,
  };
}

export function pct(value: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}
