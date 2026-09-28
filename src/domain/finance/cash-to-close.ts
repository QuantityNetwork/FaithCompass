import type { ISODate } from "../entities";
import { daysBetween, daysInYear, endOfMonth, parseISODate } from "../dates";

export const CASH_TO_CLOSE_CATEGORIES = [
  "down_payment",
  "lender_costs",
  "title",
  "settlement",
  "escrow",
  "prepaid",
  "taxes",
  "other",
] as const;
export type CashToCloseCategory = (typeof CASH_TO_CLOSE_CATEGORIES)[number];

export type Basis = "provided" | "record" | "assumption";

export interface CashToCloseLine {
  category: CashToCloseCategory;
  label: string;
  amount_cents: number;
  basis: Basis;
  note?: string;
}

export interface CashToCloseCredit {
  label: string;
  amount_cents: number;
  basis: Basis;
  note?: string;
}

export interface CashToCloseInput {
  purchasePriceCents: number;
  downPaymentCents: number;
  annualRatePercent: number;
  closingDate: ISODate;
  points?: number;
  annualTaxCents?: number | null;
  annualInsuranceCents?: number | null;
  hoaMonthlyCents?: number | null;
  escrowTaxesAndInsurance?: boolean;
  earnestMoneyCents?: number;
  sellerCreditCents?: number;
  /** Taxes paid in arrears (e.g. Texas): seller credits the buyer for the year-to-date share. */
  taxesPaidInArrears?: boolean;
  basis?: Partial<Record<"price" | "downPayment" | "rate" | "tax" | "insurance" | "hoa" | "earnest", Basis>>;
}

export interface CashToCloseResult {
  loan_amount_cents: number;
  lines: CashToCloseLine[];
  subtotal_by_category: Record<CashToCloseCategory, number>;
  gross_cents: number;
  credits: CashToCloseCredit[];
  credits_total_cents: number;
  cash_to_close_cents: number;
  assumptions: string[];
}

/** Assumed fee schedule. Values are conservative US market estimates, not quotes. */
export const FEE_ASSUMPTIONS = {
  originationPercent: 0.5,
  underwritingCents: 119_500,
  appraisalCents: 65_000,
  creditReportCents: 8_500,
  lenderTitlePolicyPercent: 0.22,
  settlementFeeCents: 110_000,
  recordingCents: 17_500,
  surveyCents: 52_500,
  hoaTransferCents: 35_000,
  escrowCushionMonths: 3,
} as const;

export function estimateCashToClose(input: CashToCloseInput): CashToCloseResult {
  const b = input.basis ?? {};
  const loan = Math.max(0, input.purchasePriceCents - input.downPaymentCents);
  const lines: CashToCloseLine[] = [];
  const assumptions: string[] = [];

  lines.push({
    category: "down_payment",
    label: "Down payment",
    amount_cents: input.downPaymentCents,
    basis: b.downPayment ?? "provided",
  });

  if (loan > 0) {
    lines.push({
      category: "lender_costs",
      label: `Origination (${FEE_ASSUMPTIONS.originationPercent}% of loan)`,
      amount_cents: Math.round((loan * FEE_ASSUMPTIONS.originationPercent) / 100),
      basis: "assumption",
    });
    lines.push({ category: "lender_costs", label: "Underwriting", amount_cents: FEE_ASSUMPTIONS.underwritingCents, basis: "assumption" });
    lines.push({ category: "lender_costs", label: "Appraisal", amount_cents: FEE_ASSUMPTIONS.appraisalCents, basis: "assumption" });
    lines.push({ category: "lender_costs", label: "Credit report", amount_cents: FEE_ASSUMPTIONS.creditReportCents, basis: "assumption" });
    if (input.points && input.points > 0) {
      lines.push({
        category: "lender_costs",
        label: `Discount points (${input.points})`,
        amount_cents: Math.round((loan * input.points) / 100),
        basis: "provided",
      });
    }
    lines.push({
      category: "title",
      label: "Lender's title policy",
      amount_cents: Math.round((loan * FEE_ASSUMPTIONS.lenderTitlePolicyPercent) / 100),
      basis: "assumption",
    });
    assumptions.push("Lender fees and the lender's title policy are market estimates, not quotes.");
  }

  lines.push({ category: "settlement", label: "Escrow / settlement fee", amount_cents: FEE_ASSUMPTIONS.settlementFeeCents, basis: "assumption" });
  lines.push({ category: "settlement", label: "Recording fees", amount_cents: FEE_ASSUMPTIONS.recordingCents, basis: "assumption" });
  lines.push({ category: "other", label: "Survey", amount_cents: FEE_ASSUMPTIONS.surveyCents, basis: "assumption" });
  if (input.hoaMonthlyCents && input.hoaMonthlyCents > 0) {
    lines.push({ category: "other", label: "HOA transfer fee", amount_cents: FEE_ASSUMPTIONS.hoaTransferCents, basis: "assumption" });
  }

  // Prepaid interest from closing through month end.
  if (loan > 0) {
    const closing = parseISODate(input.closingDate);
    const days = daysBetween(input.closingDate, endOfMonth(input.closingDate)) + 1;
    const dailyInterest = (loan * (input.annualRatePercent / 100)) / daysInYear(closing.getUTCFullYear());
    lines.push({
      category: "prepaid",
      label: `Prepaid interest (${days} days)`,
      amount_cents: Math.round(dailyInterest * days),
      basis: b.rate ?? "provided",
    });
  }

  if (input.annualInsuranceCents) {
    lines.push({
      category: "prepaid",
      label: "Homeowner's insurance — first-year premium",
      amount_cents: input.annualInsuranceCents,
      basis: b.insurance ?? "provided",
    });
  } else {
    assumptions.push("No insurance premium supplied; first-year premium excluded.");
  }

  if (input.escrowTaxesAndInsurance) {
    const monthly = ((input.annualTaxCents ?? 0) + (input.annualInsuranceCents ?? 0)) / 12;
    lines.push({
      category: "escrow",
      label: `Initial escrow deposit (${FEE_ASSUMPTIONS.escrowCushionMonths} months)`,
      amount_cents: Math.round(monthly * FEE_ASSUMPTIONS.escrowCushionMonths),
      basis: "assumption",
    });
  }

  const credits: CashToCloseCredit[] = [];
  if (input.earnestMoneyCents && input.earnestMoneyCents > 0) {
    credits.push({ label: "Earnest money deposited", amount_cents: input.earnestMoneyCents, basis: b.earnest ?? "provided" });
  }
  if (input.sellerCreditCents && input.sellerCreditCents > 0) {
    credits.push({ label: "Seller credit", amount_cents: input.sellerCreditCents, basis: "provided" });
  }
  if (input.annualTaxCents && input.taxesPaidInArrears) {
    const closing = parseISODate(input.closingDate);
    const year = closing.getUTCFullYear();
    const elapsed = daysBetween(`${year}-01-01`, input.closingDate);
    const proration = Math.round((input.annualTaxCents * elapsed) / daysInYear(year));
    credits.push({
      label: `Property-tax proration credit (${elapsed} days)`,
      amount_cents: proration,
      basis: "assumption",
      note: "Taxes paid in arrears; seller credits the buyer for the year-to-date share.",
    });
    lines.push({
      category: "taxes",
      label: "Property taxes due at closing",
      amount_cents: 0,
      basis: "assumption",
      note: "Taxes are paid in arrears; none due at closing.",
    });
  }

  const subtotal = Object.fromEntries(CASH_TO_CLOSE_CATEGORIES.map((c) => [c, 0])) as Record<CashToCloseCategory, number>;
  for (const line of lines) subtotal[line.category] += line.amount_cents;
  const gross = lines.reduce((acc, l) => acc + l.amount_cents, 0);
  const creditsTotal = credits.reduce((acc, c) => acc + c.amount_cents, 0);

  return {
    loan_amount_cents: loan,
    lines,
    subtotal_by_category: subtotal,
    gross_cents: gross,
    credits,
    credits_total_cents: creditsTotal,
    cash_to_close_cents: gross - creditsTotal,
    assumptions,
  };
}
