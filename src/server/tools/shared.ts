import type { LoanRow, PropertyRow, TransactionRow } from "@/domain/entities";
import { daysBetween } from "@/domain/dates";
import { estimateCashToClose, type CashToCloseResult } from "@/domain/finance/cash-to-close";
import type { NormalizedAccount } from "@/server/integrations/financial/types";
import type { ToolContext } from "./types";

/** Texas and several other states collect property tax in arrears. */
const ARREARS_STATES = new Set(["TX", "CA", "IL", "OH", "IN"]);

export function taxesPaidInArrears(property: PropertyRow): boolean {
  return ARREARS_STATES.has(property.region.toUpperCase());
}

export async function loanForTransaction(ctx: ToolContext, tx: TransactionRow): Promise<LoanRow | null> {
  const loans = await ctx.data.listLoans({ transactionId: tx.id });
  return loans[0] ?? null;
}

/** Estimated cash to close derived entirely from Sagolik records. */
export async function cashToCloseFromRecords(
  ctx: ToolContext,
  tx: TransactionRow,
  property: PropertyRow,
): Promise<{ result: CashToCloseResult; loan: LoanRow | null }> {
  const loan = await loanForTransaction(ctx, tx);
  const result = estimateCashToClose({
    purchasePriceCents: tx.purchase_price_cents,
    downPaymentCents: tx.down_payment_cents,
    annualRatePercent: loan?.annual_rate_percent ?? 0,
    closingDate: tx.closing_date ?? ctx.today,
    points: loan?.points ?? 0,
    annualTaxCents: property.annual_tax_estimate_cents,
    annualInsuranceCents: property.annual_insurance_estimate_cents,
    hoaMonthlyCents: property.hoa_monthly_cents,
    escrowTaxesAndInsurance: loan?.escrow_included ?? false,
    earnestMoneyCents: tx.earnest_money_cents,
    sellerCreditCents: tx.seller_credit_cents,
    taxesPaidInArrears: taxesPaidInArrears(property),
    basis: { price: "record", downPayment: "record", rate: "record", tax: "record", insurance: "record", hoa: "record", earnest: "record" },
  });
  return { result, loan };
}

export type FundsStatus = "ready" | "ready_pending_transfers" | "shortfall" | "insufficient_data";

export interface FundsAssessment {
  status: FundsStatus;
  requiredCents: number;
  verifiedCents: number;
  pendingIncomingCents: number;
  liquidAccounts: NormalizedAccount[];
  pendingTransfers: { amount_cents: number; description: string; posted_on: string }[];
  issues: string[];
  daysToClosing: number | null;
}

/**
 * Indicative funds readiness from normalized provider data. Only depository
 * balances count as verified liquid funds; incoming pending transfers are
 * reported separately. This is never a final verification of funds.
 */
export async function assessFundsReadiness(ctx: ToolContext, tx: TransactionRow, property: PropertyRow): Promise<FundsAssessment> {
  const { result } = await cashToCloseFromRecords(ctx, tx, property);
  const required = Math.max(0, result.cash_to_close_cents);
  const accounts = await ctx.financial.accounts();
  const liquid = accounts.items.filter((a) => a.liquid);
  const verified = liquid.reduce((acc, a) => acc + (a.available_balance_cents ?? a.current_balance_cents), 0);
  const issues = accounts.issues.map((i) => `${i.institution}: ${i.message}`);

  const since = new Date(ctx.now.getTime() - 14 * 86_400_000).toISOString().slice(0, 10);
  const txns = await ctx.financial.transactions(since);
  const liquidIds = new Set(liquid.map((a) => a.id));
  const pending = txns.items.filter((t) => t.status === "pending" && t.amount_cents > 0 && liquidIds.has(t.account_id));
  const pendingIncoming = pending.reduce((acc, t) => acc + t.amount_cents, 0);
  issues.push(...txns.issues.map((i) => `${i.institution}: ${i.message}`));

  let status: FundsStatus;
  if (liquid.length === 0) status = "insufficient_data";
  else if (verified >= required) status = "ready";
  else if (verified + pendingIncoming >= required) status = "ready_pending_transfers";
  else status = "shortfall";

  return {
    status,
    requiredCents: required,
    verifiedCents: verified,
    pendingIncomingCents: pendingIncoming,
    liquidAccounts: liquid,
    pendingTransfers: pending.map((t) => ({ amount_cents: t.amount_cents, description: t.description, posted_on: t.posted_on })),
    issues,
    daysToClosing: tx.closing_date ? daysBetween(ctx.today, tx.closing_date) : null,
  };
}
