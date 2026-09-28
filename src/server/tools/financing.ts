import { z } from "zod";
import { daysBetween } from "@/domain/dates";
import { CASH_TO_CLOSE_CATEGORIES, estimateCashToClose } from "@/domain/finance/cash-to-close";
import { loanToValuePercent, simulateLoan, totalInterestCents } from "@/domain/finance/mortgage";
import { formatUsd, toCents } from "@/domain/money";
import { hasScope, requireScopes } from "./access";
import { money, pct, propertyRef, transactionRef } from "./format";
import { operational } from "./meta";
import { resolveProperty, resolveTransaction } from "./resolve";
import { basisEnum, moneyOutput, propertyIdInput, propertyRefOutput, transactionIdInput, transactionRefOutput } from "./schemas";
import { loanForTransaction, taxesPaidInArrears } from "./shared";
import { defineTool, type ToolWarning } from "./types";

/* ───────────────────────── get_financing_status ───────────────────────── */

export const getFinancingStatus = defineTool({
  name: "get_financing_status",
  title: "Get financing status",
  version: "1.0.0",
  category: "financing",
  executionClass: "read",
  ...operational("read"),
  owner: "sagolik-finance",
  requiredScopes: ["transaction.read"],
  approvalRequired: false,
  idempotency: "none",
  providers: [],
  description: {
    summary: "Return the loan attached to a purchase: lender, status, principal, rate, term, payment, rate lock, required actions and financing blockers.",
    whenToUse: ["When the user asks where their mortgage or loan approval stands, or what the lender still needs."],
    whenNotToUse: [
      "To model alternative loans — use compare_financing_scenarios.",
      "For the overall closing picture — use get_closing_status.",
    ],
    requiredContext: ["A transaction_id, or a property_id with exactly one purchase transaction."],
    effect: "Read-only.",
    limitations: ["Loan numbers are masked. Status reflects the lender's most recent update to Sagolik."],
    example: { request: "Is my loan approved yet?", arguments: { property_id: "SGK-1042" } },
  },
  input: z.strictObject({ transaction_id: transactionIdInput.optional(), property_id: propertyIdInput.optional() }),
  output: z.object({
    property: propertyRefOutput,
    transaction: transactionRefOutput,
    loan: z
      .object({
        lender: z.string(),
        loan_reference: z.string(),
        status: z.string(),
        loan_type: z.string(),
        rate_type: z.string(),
        principal: moneyOutput,
        interest_rate_percent: z.number(),
        term_months: z.int(),
        points: z.number(),
        monthly_principal_interest: moneyOutput,
        escrow_included: z.boolean(),
        rate_lock_expires_on: z.string().nullable(),
        rate_lock_covers_closing: z.boolean().nullable(),
      })
      .nullable(),
    required_actions: z.array(z.string()),
    documentation_status: z.enum(["complete", "incomplete", "unknown"]),
    financing_documents: z.object({ accepted: z.int(), outstanding: z.int() }).nullable(),
    blockers: z.array(z.object({ title: z.string(), severity: z.string(), owner: z.string(), deadline: z.string().nullable(), recommended_action: z.string() })),
  }),
})({
  async handler(ctx, input) {
    const resolved = await resolveTransaction(ctx, input, { includeClosed: true });
    if (!resolved.ok) return resolved.outcome;
    const { transaction: tx, property } = resolved.value;
    const loan = await loanForTransaction(ctx, tx);
    const blockers = hasScope(ctx, "closing.read")
      ? (await ctx.data.listBlockers(tx.id)).filter((b) => b.status === "open" && b.stage === "financing")
      : [];
    const financingDocs = hasScope(ctx, "documents.read")
      ? (await ctx.data.listDocuments({ transactionId: tx.id })).filter((d) => d.category === "financing" && d.required_for_closing)
      : null;

    const lockCovers = loan?.rate_lock_expires_on && tx.closing_date ? loan.rate_lock_expires_on >= tx.closing_date : null;
    const warnings: ToolWarning[] = [];
    if (lockCovers === false) warnings.push({ code: "rate_lock_expires_before_closing", message: "The rate lock expires before the scheduled closing date." });
    if (!hasScope(ctx, "closing.read")) warnings.push({ code: "blockers_not_evaluated", message: "Financing blockers require closing.read." });

    return {
      status: "success",
      data: {
        property: propertyRef(property),
        transaction: transactionRef(tx),
        loan: loan
          ? {
              lender: loan.lender_name,
              loan_reference: loan.loan_reference_masked,
              status: loan.status,
              loan_type: loan.loan_type,
              rate_type: loan.rate_type,
              principal: money(loan.principal_cents),
              interest_rate_percent: loan.annual_rate_percent,
              term_months: loan.term_months,
              points: loan.points,
              monthly_principal_interest: money(loan.monthly_principal_interest_cents),
              escrow_included: loan.escrow_included,
              rate_lock_expires_on: loan.rate_lock_expires_on,
              rate_lock_covers_closing: tx.status === "active" ? lockCovers : null,
            }
          : null,
        required_actions: loan?.required_actions ?? [],
        documentation_status: loan ? (loan.documentation_complete ? "complete" : "incomplete") : "unknown",
        financing_documents: financingDocs
          ? { accepted: financingDocs.filter((d) => d.status === "accepted").length, outstanding: financingDocs.filter((d) => d.status !== "accepted").length }
          : null,
        blockers: blockers.map((b) => ({ title: b.title, severity: b.severity, owner: b.owner, deadline: b.deadline, recommended_action: b.recommended_action })),
      },
      summary: loan
        ? `${loan.lender_name}: ${loan.status.replaceAll("_", " ")} — ${formatUsd(loan.principal_cents)} at ${loan.annual_rate_percent}% for ${loan.term_months / 12} years (${formatUsd(loan.monthly_principal_interest_cents, { precise: true })}/month P&I). ${loan.required_actions.length} required action(s).`
        : `No loan is recorded for transaction ${tx.reference}.`,
      warnings,
    };
  },
});

/* ───────────────────────── compare_financing_scenarios ───────────────────────── */

const scenarioInput = z.strictObject({
  label: z.string().trim().min(1).max(60),
  down_payment_percent: z.number().min(0).max(100).optional(),
  down_payment_amount: z.number().nonnegative().optional(),
  interest_rate_percent: z.number().min(0).max(20).describe("Initial annual rate."),
  term_years: z.union([z.literal(10), z.literal(15), z.literal(20), z.literal(30)]),
  rate_type: z.enum(["fixed", "adjustable"]).default("fixed"),
  arm_fixed_years: z.int().min(1).max(10).optional().describe("Adjustable only: years before the first reset (e.g. 5 for a 5/6 ARM)."),
  arm_adjusted_rate_percent: z.number().min(0).max(20).optional().describe("Adjustable only: assumed rate after reset."),
  points: z.number().min(0).max(4).default(0).describe("Discount points; 1 point = 1% of the loan paid upfront."),
});

export const compareFinancingScenarios = defineTool({
  name: "compare_financing_scenarios",
  title: "Compare financing scenarios",
  version: "1.0.0",
  category: "financing",
  executionClass: "simulate",
  ...operational("simulate"),
  owner: "sagolik-finance",
  requiredScopes: ["scenario.run"],
  approvalRequired: false,
  idempotency: "none",
  providers: [],
  description: {
    summary: "Compare up to six financing configurations — down payment, rate, fixed vs adjustable, term and points — on monthly cost, upfront cash and cost over a horizon.",
    whenToUse: ["When the user wants to weigh loan options against each other."],
    whenNotToUse: [
      "For the status of an existing loan — use get_financing_status.",
      "For a single end-to-end purchase analysis — use analyze_property_purchase.",
    ],
    requiredContext: [
      "A purchase_price, or a property_id with a price on record (requires property.read).",
      "One to six scenarios, each with a label, rate and term.",
    ],
    effect: "Simulation only. Nothing is stored and no records change.",
    limitations: [
      "Adjustable-rate results depend entirely on the assumed reset rate.",
      "Mortgage insurance is estimated at 0.5% of the loan per year while LTV exceeds 78%.",
    ],
    example: {
      request: "Compare 25% down at 6.375% fixed with a 5/6 ARM at 5.75%.",
      arguments: {
        property_id: "SGK-1042",
        scenarios: [
          { label: "30-year fixed", down_payment_percent: 25, interest_rate_percent: 6.375, term_years: 30 },
          { label: "5/6 ARM", down_payment_percent: 25, interest_rate_percent: 5.75, term_years: 30, rate_type: "adjustable", arm_fixed_years: 5, arm_adjusted_rate_percent: 7.25 },
        ],
      },
    },
  },
  input: z.strictObject({
    property_id: propertyIdInput.optional(),
    purchase_price: z.number().positive().max(100_000_000).optional(),
    annual_property_tax: z.number().nonnegative().optional(),
    annual_insurance: z.number().nonnegative().optional(),
    monthly_hoa: z.number().nonnegative().optional(),
    horizon_years: z.int().min(1).max(30).default(7).describe("Holding period used for cost-over-horizon comparison."),
    scenarios: z.array(scenarioInput).min(1).max(6),
  }),
  output: z.object({
    property: propertyRefOutput.nullable(),
    purchase_price: moneyOutput,
    horizon_years: z.int(),
    scenarios: z.array(
      z.object({
        label: z.string(),
        rate_type: z.enum(["fixed", "adjustable"]),
        interest_rate_percent: z.number(),
        term_years: z.int(),
        down_payment: moneyOutput,
        down_payment_percent: z.number(),
        loan_amount: moneyOutput,
        loan_to_value_percent: z.number(),
        points_cost: moneyOutput,
        upfront_cash: moneyOutput,
        monthly_principal_interest: moneyOutput,
        monthly_mortgage_insurance: moneyOutput,
        monthly_taxes_insurance_hoa: moneyOutput,
        monthly_carrying_cost: moneyOutput,
        payment_after_reset: moneyOutput.nullable(),
        total_interest_over_term: moneyOutput.nullable(),
        financing_cost_over_horizon: moneyOutput,
        balance_at_horizon: moneyOutput,
      }),
    ),
    comparison: z.object({
      lowest_monthly: z.string(),
      lowest_upfront: z.string(),
      lowest_cost_over_horizon: z.string(),
      deltas_vs_first: z.array(z.object({ label: z.string(), monthly_delta: moneyOutput, upfront_delta: moneyOutput, horizon_cost_delta: moneyOutput })),
    }),
    assumptions: z.array(z.string()),
  }),
})({
  async handler(ctx, input) {
    let property = null;
    if (input.property_id) {
      const denied = requireScopes(ctx, ["property.read"], "Using a property record in this comparison");
      if (denied) return denied;
      const resolved = await resolveProperty(ctx, input.property_id);
      if (!resolved.ok) return resolved.outcome;
      property = resolved.value;
    }
    const priceCents = input.purchase_price !== undefined ? toCents(input.purchase_price) : (property?.purchase_price_cents ?? property?.list_price_cents ?? null);
    if (!priceCents) {
      return { status: "needs_input", missing_fields: ["purchase_price"], message: "A purchase price is required, directly or from a property record." };
    }
    const assumptions: string[] = ["Financing cost over horizon = interest + mortgage insurance + points; principal repayment is excluded because it builds equity."];
    const tax = input.annual_property_tax !== undefined ? toCents(input.annual_property_tax) : (property?.annual_tax_estimate_cents ?? Math.round(priceCents * 0.018));
    const ins = input.annual_insurance !== undefined ? toCents(input.annual_insurance) : (property?.annual_insurance_estimate_cents ?? Math.round(priceCents * 0.0045));
    const hoa = input.monthly_hoa !== undefined ? toCents(input.monthly_hoa) : (property?.hoa_monthly_cents ?? 0);
    if (input.annual_property_tax === undefined && !property?.annual_tax_estimate_cents) assumptions.push("Property tax assumed at 1.8% of price per year.");
    if (input.annual_insurance === undefined && !property?.annual_insurance_estimate_cents) assumptions.push("Insurance assumed at 0.45% of price per year.");
    const monthlyTih = Math.round(tax / 12) + Math.round(ins / 12) + hoa;
    const horizonMonths = input.horizon_years * 12;

    const incompleteArm = input.scenarios.filter((s) => s.rate_type === "adjustable" && (s.arm_fixed_years === undefined || s.arm_adjusted_rate_percent === undefined));
    if (incompleteArm.length) {
      return {
        status: "needs_input",
        missing_fields: ["scenarios[].arm_fixed_years", "scenarios[].arm_adjusted_rate_percent"],
        message: `Adjustable scenarios need arm_fixed_years and arm_adjusted_rate_percent: ${incompleteArm.map((s) => s.label).join(", ")}.`,
      };
    }

    const results = input.scenarios.map((s) => {
      if (s.down_payment_amount === undefined && s.down_payment_percent === undefined) assumptions.push(`${s.label}: down payment assumed at 20%.`);
      const down = s.down_payment_amount !== undefined ? toCents(s.down_payment_amount) : Math.round((priceCents * (s.down_payment_percent ?? 20)) / 100);
      const loan = Math.max(0, priceCents - down);
      const termMonths = s.term_years * 12;
      const adjustable = s.rate_type === "adjustable";
      const resetMonth = adjustable ? (s.arm_fixed_years ?? 0) * 12 : Number.POSITIVE_INFINITY;
      const adjustedRate = s.arm_adjusted_rate_percent ?? s.interest_rate_percent;
      const sim = simulateLoan({
        principalCents: loan,
        termMonths,
        horizonMonths,
        propertyValueCents: priceCents,
        rateForMonth: (m) => (m > resetMonth ? adjustedRate : s.interest_rate_percent),
      });
      const pmiMonthly = simulateLoan({ principalCents: loan, termMonths, horizonMonths: 1, propertyValueCents: priceCents, rateForMonth: () => s.interest_rate_percent }).pmiPaidCents;
      const points = Math.round((loan * s.points) / 100);
      const monthly = sim.firstPaymentCents + pmiMonthly + monthlyTih;
      const upfront = down + points;
      const horizon = sim.interestPaidCents + sim.pmiPaidCents + points;
      return {
        metrics: { label: s.label, monthly, upfront, horizon },
        row: {
          label: s.label,
          rate_type: s.rate_type,
          interest_rate_percent: s.interest_rate_percent,
          term_years: s.term_years,
          down_payment: money(down),
          down_payment_percent: pct((down / priceCents) * 100),
          loan_amount: money(loan),
          loan_to_value_percent: loanToValuePercent(loan, priceCents),
          points_cost: money(points),
          upfront_cash: money(upfront),
          monthly_principal_interest: money(sim.firstPaymentCents),
          monthly_mortgage_insurance: money(pmiMonthly),
          monthly_taxes_insurance_hoa: money(monthlyTih),
          monthly_carrying_cost: money(monthly),
          payment_after_reset: adjustable ? money(sim.paymentAfterFirstResetCents ?? sim.firstPaymentCents) : null,
          total_interest_over_term: adjustable ? null : money(totalInterestCents(loan, s.interest_rate_percent, termMonths)),
          financing_cost_over_horizon: money(horizon),
          balance_at_horizon: money(sim.balanceCents),
        },
      };
    });
    const metrics = results.map((r) => r.metrics);
    const lowest = (key: "monthly" | "upfront" | "horizon") => metrics.reduce((a, b) => (b[key] < a[key] ? b : a)).label;
    const first = metrics[0]!;
    return {
      status: "success",
      data: {
        property: property ? propertyRef(property) : null,
        purchase_price: money(priceCents),
        horizon_years: input.horizon_years,
        scenarios: results.map((r) => r.row),
        comparison: {
          lowest_monthly: lowest("monthly"),
          lowest_upfront: lowest("upfront"),
          lowest_cost_over_horizon: lowest("horizon"),
          deltas_vs_first: metrics.slice(1).map((m) => ({
            label: m.label,
            monthly_delta: money(m.monthly - first.monthly),
            upfront_delta: money(m.upfront - first.upfront),
            horizon_cost_delta: money(m.horizon - first.horizon),
          })),
        },
        assumptions,
      },
      summary: `Compared ${results.length} scenario(s) over ${input.horizon_years} years. Lowest monthly: ${lowest("monthly")}. Lowest upfront: ${lowest("upfront")}. Lowest financing cost over horizon: ${lowest("horizon")}.`,
      warnings: [{ code: "estimates", message: "All figures are estimates, not lender quotes." }],
    };
  },
});

/* ───────────────────────── calculate_cash_to_close ───────────────────────── */

const breakdownLine = z.object({ label: z.string(), amount: moneyOutput, basis: basisEnum, note: z.string().optional() });

export const calculateCashToClose = defineTool({
  name: "calculate_cash_to_close",
  title: "Calculate cash to close",
  version: "1.0.0",
  category: "financing",
  executionClass: "simulate",
  ...operational("simulate"),
  owner: "sagolik-finance",
  requiredScopes: ["scenario.run"],
  approvalRequired: false,
  idempotency: "none",
  providers: [],
  description: {
    summary: "Estimate the total cash required at closing, separated into down payment, lender costs, escrow, prepaid costs, taxes, title, settlement and other fees, less credits.",
    whenToUse: [
      "When the user asks how much money they need to bring to closing.",
      "Before verify_funds_readiness, to explain how the required amount is composed.",
    ],
    whenNotToUse: [
      "To check whether funds are actually available — use verify_funds_readiness.",
      "As a substitute for the lender's closing disclosure, which is authoritative once issued.",
    ],
    requiredContext: [
      "Either a transaction_id / property_id (uses Sagolik records; requires transaction.read), or purchase_price, a down payment, interest_rate_percent and closing_date.",
      "Explicit inputs override record values.",
    ],
    effect: "Simulation only. Nothing is stored and no records change.",
    limitations: ["Fees without a record or input use a market fee schedule and are marked as assumptions."],
    example: { request: "How much cash do I need at closing for 245 Mercer?", arguments: { property_id: "SGK-1042" } },
  },
  input: z.strictObject({
    transaction_id: transactionIdInput.optional(),
    property_id: propertyIdInput.optional(),
    purchase_price: z.number().positive().max(100_000_000).optional(),
    down_payment_amount: z.number().nonnegative().optional(),
    down_payment_percent: z.number().min(0).max(100).optional(),
    interest_rate_percent: z.number().min(0).max(20).optional(),
    closing_date: z.iso.date().optional().describe("Closing date, YYYY-MM-DD."),
    annual_property_tax: z.number().nonnegative().optional(),
    annual_insurance: z.number().nonnegative().optional(),
    monthly_hoa: z.number().nonnegative().optional(),
    earnest_money: z.number().nonnegative().optional(),
    seller_credit: z.number().nonnegative().optional(),
    points: z.number().min(0).max(4).optional(),
    escrow_taxes_and_insurance: z.boolean().optional(),
    taxes_paid_in_arrears: z.boolean().optional(),
  }),
  output: z.object({
    property: propertyRefOutput.nullable(),
    transaction: transactionRefOutput.nullable(),
    loan_amount: moneyOutput,
    breakdown: z.array(z.object({ category: z.enum(CASH_TO_CLOSE_CATEGORIES), subtotal: moneyOutput, lines: z.array(breakdownLine) })),
    gross_costs: moneyOutput,
    credits: z.array(breakdownLine),
    credits_total: moneyOutput,
    estimated_cash_to_close: moneyOutput,
    days_to_closing: z.int().nullable(),
    assumptions: z.array(z.string()),
    disclaimer: z.string(),
  }),
})({
  async handler(ctx, input) {
    let tx = null;
    let property = null;
    let loan = null;
    if (input.transaction_id || input.property_id) {
      const denied = requireScopes(ctx, ["transaction.read"], "Calculating from Sagolik transaction records");
      if (denied) return denied;
      const resolved = await resolveTransaction(ctx, input);
      if (!resolved.ok) return resolved.outcome;
      tx = resolved.value.transaction;
      property = resolved.value.property;
      loan = await loanForTransaction(ctx, tx);
    }

    const price = input.purchase_price !== undefined ? toCents(input.purchase_price) : (tx?.purchase_price_cents ?? null);
    const down =
      input.down_payment_amount !== undefined
        ? toCents(input.down_payment_amount)
        : input.down_payment_percent !== undefined && price !== null
          ? Math.round((price * input.down_payment_percent) / 100)
          : (tx?.down_payment_cents ?? null);
    const rate = input.interest_rate_percent ?? loan?.annual_rate_percent ?? null;
    const closingDate = input.closing_date ?? tx?.closing_date ?? null;

    const missing: string[] = [];
    if (price === null) missing.push("purchase_price");
    if (down === null) missing.push("down_payment_amount");
    if (rate === null) missing.push("interest_rate_percent");
    if (closingDate === null) missing.push("closing_date");
    if (price === null || down === null || rate === null || closingDate === null) {
      return {
        status: "needs_input",
        missing_fields: missing,
        message: "Provide a transaction_id or property_id, or supply the missing values directly.",
      };
    }
    if (down > price) return { status: "needs_clarification", field: "down_payment_amount", message: "The down payment exceeds the purchase price." };

    const fromInput = <T,>(v: T | undefined) => v !== undefined;
    const result = estimateCashToClose({
      purchasePriceCents: price,
      downPaymentCents: down,
      annualRatePercent: rate,
      closingDate,
      points: input.points ?? loan?.points ?? 0,
      annualTaxCents: input.annual_property_tax !== undefined ? toCents(input.annual_property_tax) : (property?.annual_tax_estimate_cents ?? null),
      annualInsuranceCents: input.annual_insurance !== undefined ? toCents(input.annual_insurance) : (property?.annual_insurance_estimate_cents ?? null),
      hoaMonthlyCents: input.monthly_hoa !== undefined ? toCents(input.monthly_hoa) : (property?.hoa_monthly_cents ?? null),
      escrowTaxesAndInsurance: input.escrow_taxes_and_insurance ?? loan?.escrow_included ?? false,
      earnestMoneyCents: input.earnest_money !== undefined ? toCents(input.earnest_money) : (tx?.earnest_money_cents ?? 0),
      sellerCreditCents: input.seller_credit !== undefined ? toCents(input.seller_credit) : (tx?.seller_credit_cents ?? 0),
      taxesPaidInArrears: input.taxes_paid_in_arrears ?? (property ? taxesPaidInArrears(property) : false),
      basis: {
        downPayment: fromInput(input.down_payment_amount) || fromInput(input.down_payment_percent) ? "provided" : "record",
        rate: fromInput(input.interest_rate_percent) ? "provided" : "record",
        insurance: fromInput(input.annual_insurance) ? "provided" : "record",
        earnest: fromInput(input.earnest_money) ? "provided" : "record",
      },
    });

    const breakdown = CASH_TO_CLOSE_CATEGORIES.map((category) => ({
      category,
      subtotal: money(result.subtotal_by_category[category]),
      lines: result.lines
        .filter((l) => l.category === category)
        .map((l) => ({ label: l.label, amount: money(l.amount_cents), basis: l.basis, ...(l.note ? { note: l.note } : {}) })),
    }));

    return {
      status: "success",
      data: {
        property: property ? propertyRef(property) : null,
        transaction: tx ? transactionRef(tx) : null,
        loan_amount: money(result.loan_amount_cents),
        breakdown,
        gross_costs: money(result.gross_cents),
        credits: result.credits.map((c) => ({ label: c.label, amount: money(c.amount_cents), basis: c.basis, ...(c.note ? { note: c.note } : {}) })),
        credits_total: money(result.credits_total_cents),
        estimated_cash_to_close: money(result.cash_to_close_cents),
        days_to_closing: daysBetween(ctx.today, closingDate),
        assumptions: result.assumptions,
        disclaimer: "Estimate only. The lender's closing disclosure is the authoritative figure once issued.",
      },
      summary: `Estimated cash to close: ${formatUsd(result.cash_to_close_cents)} (gross ${formatUsd(result.gross_cents)} less ${formatUsd(result.credits_total_cents)} in credits).`,
      warnings: [{ code: "estimate", message: "Figures are estimates until the closing disclosure is issued." }],
    };
  },
});
