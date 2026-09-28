import { z } from "zod";
import type { PropertyStatus } from "@/domain/entities";
import { addDays } from "@/domain/dates";
import { estimateCashToClose } from "@/domain/finance/cash-to-close";
import { maintenanceReserveMonthlyCents, monthlyEquivalentCents } from "@/domain/finance/cashflow";
import { estimatedMonthlyPmiCents, loanToValuePercent, monthlyPaymentCents } from "@/domain/finance/mortgage";
import { formatUsd, toCents } from "@/domain/money";
import { hasScope, requireScopes, restricted } from "./access";
import { formatAddress, money, moneyOrNull, pct, propertyRef, transactionRef } from "./format";
import { operational } from "./meta";
import { resolveProperty, resolveTransaction } from "./resolve";
import {
  basisEnum,
  moneyOutput,
  propertyIdInput,
  propertyRefOutput,
  restrictedSection,
  transactionIdInput,
  transactionRefOutput,
} from "./schemas";
import { defineTool } from "./types";

const PROPERTY_STATUSES = ["prospective", "under_contract", "closing", "owned", "sold"] as const;

/* ───────────────────────── search_properties ───────────────────────── */

export const searchProperties = defineTool({
  name: "search_properties",
  title: "Search properties",
  version: "1.0.0",
  category: "property",
  executionClass: "read",
  ...operational("read"),
  owner: "sagolik-property",
  requiredScopes: ["property.read"],
  approvalRequired: false,
  idempotency: "none",
  providers: [],
  description: {
    summary: "Find property records the authenticated user is authorized to access, and obtain their exact identifiers.",
    whenToUse: [
      "Before any property-specific tool when you do not already have an exact property identifier (e.g. SGK-1042).",
      "When the user refers to a property by address, city or status.",
    ],
    whenNotToUse: [
      "When you already hold an exact property_id — call the specific tool directly.",
      "To discover properties outside the user's organization; they are never returned.",
    ],
    requiredContext: ["Optional: a location query, a property_id, a transaction_id or a status filter."],
    effect: "Read-only. Returns property summaries and identifiers.",
    example: { request: "Which property is currently closing?", arguments: { status: ["closing"] } },
  },
  input: z.strictObject({
    query: z.string().trim().min(2).max(120).optional().describe("Free-text location or address fragment, e.g. \"Mercer\" or \"Austin\"."),
    property_id: propertyIdInput.optional(),
    transaction_id: transactionIdInput.optional(),
    status: z.array(z.enum(PROPERTY_STATUSES)).min(1).max(5).optional().describe("Filter by lifecycle status."),
    limit: z.int().min(1).max(25).default(10),
  }),
  output: z.object({
    count: z.int(),
    properties: z.array(
      z.object({
        property_id: z.string(),
        reference: z.string(),
        address: z.string(),
        city: z.string(),
        region: z.string(),
        status: z.string(),
        property_type: z.string(),
        price: moneyOutput.nullable(),
        price_basis: z.enum(["purchase", "list"]).nullable(),
        active_transaction: transactionRefOutput.nullable(),
      }),
    ),
  }),
})({
  async handler(ctx, input) {
    let properties;
    if (input.transaction_id) {
      const resolved = await resolveTransaction(ctx, { transaction_id: input.transaction_id }, { includeClosed: true });
      if (!resolved.ok) return resolved.outcome;
      properties = [resolved.value.property];
    } else if (input.property_id) {
      const resolved = await resolveProperty(ctx, input.property_id);
      if (!resolved.ok) return resolved.outcome;
      properties = [resolved.value];
    } else {
      properties = await ctx.data.listProperties({ query: input.query, statuses: input.status as PropertyStatus[] | undefined });
    }
    // Transaction references are only disclosed with transaction.read (data minimization).
    const active = hasScope(ctx, "transaction.read") ? await ctx.data.listTransactions({ status: "active" }) : [];
    const rows = properties.slice(0, input.limit).map((p) => {
      const tx = active.find((t) => t.property_id === p.id);
      return {
        property_id: p.id,
        reference: p.reference,
        address: formatAddress(p),
        city: p.city,
        region: p.region,
        status: p.status,
        property_type: p.property_type,
        price: moneyOrNull(p.purchase_price_cents ?? p.list_price_cents),
        price_basis: p.purchase_price_cents ? ("purchase" as const) : p.list_price_cents ? ("list" as const) : null,
        active_transaction: tx ? transactionRef(tx) : null,
      };
    });
    return {
      status: "success",
      data: { count: rows.length, properties: rows },
      summary: rows.length
        ? `Found ${rows.length} ${rows.length === 1 ? "property" : "properties"}: ${rows.map((r) => `${r.reference} (${r.address})`).join("; ")}.`
        : "No properties match the query in this environment.",
    };
  },
});

/* ───────────────────────── get_property ───────────────────────── */

const section = <T extends z.ZodType>(schema: T) => z.union([schema, restrictedSection]);

export const getProperty = defineTool({
  name: "get_property",
  title: "Get property",
  version: "1.0.0",
  category: "property",
  executionClass: "read",
  ...operational("read"),
  owner: "sagolik-property",
  requiredScopes: ["property.read"],
  approvalRequired: false,
  idempotency: "none",
  providers: [],
  description: {
    summary: "Retrieve the complete, permission-filtered record for one property, organized into structured sections.",
    whenToUse: ["When the user asks about a specific property's details, costs, status or connected information."],
    whenNotToUse: [
      "To find a property — use search_properties.",
      "For detailed closing, financing or document analysis — use the dedicated closing, financing or document tools.",
    ],
    requiredContext: ["An exact property_id."],
    effect: "Read-only. Sections the connection is not authorized to view are returned as restricted, naming the scope required.",
    limitations: ["Document contents and account numbers are never returned."],
    example: { request: "Give me an overview of 245 Mercer Avenue.", arguments: { property_id: "SGK-1042" } },
  },
  input: z.strictObject({ property_id: propertyIdInput }),
  output: z.object({
    property: propertyRefOutput,
    address: z.object({
      line1: z.string(),
      line2: z.string().nullable(),
      city: z.string(),
      region: z.string(),
      postal_code: z.string(),
      country: z.string(),
      formatted: z.string(),
    }),
    characteristics: z.object({
      property_type: z.string(),
      bedrooms: z.number().nullable(),
      bathrooms: z.number().nullable(),
      living_area_sqft: z.number().nullable(),
      lot_size_sqft: z.number().nullable(),
      year_built: z.number().nullable(),
    }),
    ownership: section(z.object({ status: z.string(), ownership_date: z.string().nullable(), vesting: z.string().nullable() })),
    purchase: section(
      z.object({
        list_price: moneyOutput.nullable(),
        purchase_price: moneyOutput.nullable(),
        transaction: transactionRefOutput.nullable(),
        contract_date: z.string().nullable(),
      }),
    ),
    financing: section(
      z
        .object({
          lender: z.string(),
          loan_status: z.string(),
          principal: moneyOutput,
          interest_rate_percent: z.number(),
          term_months: z.int(),
          monthly_principal_interest: moneyOutput,
        })
        .nullable(),
    ),
    taxes: z.object({ jurisdiction: z.string().nullable(), annual_estimate: moneyOutput.nullable() }),
    insurance: z.object({ annual_estimate: moneyOutput.nullable() }),
    hoa: z.object({ name: z.string().nullable(), monthly_dues: moneyOutput.nullable() }),
    documents: section(z.object({ total: z.int(), accepted: z.int(), outstanding: z.int() })),
    closing: section(z.object({ current_stage: z.string(), closing_date: z.string().nullable(), open_blockers: z.int() }).nullable()),
    obligations: section(z.object({ count: z.int(), monthly_equivalent_total: moneyOutput })),
    connected_accounts: section(z.object({ accounts: z.int(), institutions: z.array(z.string()) })),
  }),
})({
  async handler(ctx, input) {
    const resolved = await resolveProperty(ctx, input.property_id);
    if (!resolved.ok) return resolved.outcome;
    const p = resolved.value;
    const txs = await ctx.data.listTransactions({ propertyId: p.id });
    const activeTx = txs.find((t) => t.status === "active") ?? null;
    const latestTx = activeTx ?? txs[0] ?? null;

    const ownership = hasScope(ctx, "ownership.read")
      ? await ctx.data
          .getOwnershipRecord(p.id)
          .then((o) => ({ status: p.status, ownership_date: o?.ownership_date ?? null, vesting: o?.vesting ?? null }))
      : restricted("ownership.read", "Ownership details require ownership.read.");

    let purchase;
    let financing;
    if (hasScope(ctx, "transaction.read")) {
      purchase = {
        list_price: moneyOrNull(p.list_price_cents),
        purchase_price: moneyOrNull(p.purchase_price_cents),
        transaction: latestTx ? transactionRef(latestTx) : null,
        contract_date: latestTx?.contract_date ?? null,
      };
      const loan = (await ctx.data.listLoans({ propertyId: p.id }))[0];
      financing = loan
        ? {
            lender: loan.lender_name,
            loan_status: loan.status,
            principal: money(loan.principal_cents),
            interest_rate_percent: loan.annual_rate_percent,
            term_months: loan.term_months,
            monthly_principal_interest: money(loan.monthly_principal_interest_cents),
          }
        : null;
    } else {
      purchase = restricted("transaction.read", "Purchase details require transaction.read.");
      financing = restricted("transaction.read", "Financing details require transaction.read.");
    }

    const documents = hasScope(ctx, "documents.read")
      ? await ctx.data.listDocuments({ propertyId: p.id }).then((docs) => ({
          total: docs.length,
          accepted: docs.filter((d) => d.status === "accepted").length,
          outstanding: docs.filter((d) => d.required_for_closing && d.status !== "accepted").length,
        }))
      : restricted("documents.read", "Document inventory requires documents.read.");

    let closing;
    if (!hasScope(ctx, "closing.read")) closing = restricted("closing.read", "Closing status requires closing.read.");
    else if (!activeTx) closing = null;
    else {
      const open = (await ctx.data.listBlockers(activeTx.id)).filter((b) => b.status === "open").length;
      closing = { current_stage: activeTx.current_stage, closing_date: activeTx.closing_date, open_blockers: open };
    }

    const obligations = hasScope(ctx, "autopilot.read")
      ? await ctx.data.listObligations({ propertyId: p.id }).then((obs) => {
          const active = obs.filter((o) => o.status !== "ended");
          const monthly = active.reduce((acc, o) => acc + monthlyEquivalentCents(o.amount_cents, o.frequency), 0);
          return { count: active.length, monthly_equivalent_total: money(monthly) };
        })
      : restricted("autopilot.read", "Obligations require autopilot.read.");

    let connected_accounts;
    if (hasScope(ctx, "finance.read")) {
      const [connections, accounts] = await Promise.all([ctx.financial.connections(), ctx.financial.accounts()]);
      connected_accounts = { accounts: accounts.items.length, institutions: connections.map((c) => c.institution_name) };
    } else {
      connected_accounts = restricted("finance.read", "Connected accounts require finance.read.");
    }

    const sections = [ownership, purchase, financing, documents, closing, obligations, connected_accounts];
    const restrictedCount = sections.filter((s) => s !== null && typeof s === "object" && "restricted" in s).length;

    return {
      status: "success",
      data: {
        property: propertyRef(p),
        address: {
          line1: p.address_line1,
          line2: p.address_line2,
          city: p.city,
          region: p.region,
          postal_code: p.postal_code,
          country: p.country,
          formatted: formatAddress(p),
        },
        characteristics: {
          property_type: p.property_type,
          bedrooms: p.bedrooms,
          bathrooms: p.bathrooms,
          living_area_sqft: p.living_area_sqft,
          lot_size_sqft: p.lot_size_sqft,
          year_built: p.year_built,
        },
        ownership,
        purchase,
        financing,
        taxes: { jurisdiction: p.tax_jurisdiction, annual_estimate: moneyOrNull(p.annual_tax_estimate_cents) },
        insurance: { annual_estimate: moneyOrNull(p.annual_insurance_estimate_cents) },
        hoa: { name: p.hoa_name, monthly_dues: moneyOrNull(p.hoa_monthly_cents) },
        documents,
        closing,
        obligations,
        connected_accounts,
      },
      summary: `${p.reference} — ${formatAddress(p)} (${p.status.replace("_", " ")}).${
        restrictedCount ? ` ${restrictedCount} section(s) restricted by this connection's permissions.` : ""
      }`,
    };
  },
});

/* ───────────────────────── analyze_property_purchase ───────────────────────── */

type Basis = "provided" | "record" | "assumption";

export const analyzePropertyPurchase = defineTool({
  name: "analyze_property_purchase",
  title: "Analyze property purchase",
  version: "1.0.0",
  category: "property",
  executionClass: "simulate",
  ...operational("simulate"),
  owner: "sagolik-property",
  requiredScopes: ["scenario.run"],
  approvalRequired: false,
  idempotency: "none",
  providers: [],
  description: {
    summary:
      "Model a proposed property acquisition: cash required, recurring obligations, financing ratios, risk flags, missing information and scenario suggestions.",
    whenToUse: [
      "When the user is evaluating whether or how to buy a property.",
      "When the user asks what a purchase would cost upfront or monthly.",
    ],
    whenNotToUse: [
      "To compare several financing structures side by side — use compare_financing_scenarios.",
      "For an in-progress closing's cash requirement — use calculate_cash_to_close with the transaction.",
    ],
    requiredContext: [
      "A purchase_price, or a property_id whose record has a list or purchase price (requires property.read).",
      "Optional assumptions: down payment, rate, term, taxes, insurance, HOA, income and assets. Unstated values are assumed and reported under missing_information.",
    ],
    effect: "Simulation only. Nothing is stored and no records change. All results are estimates, never confirmed facts.",
    limitations: ["Closing costs use a market fee schedule, not lender quotes.", "Does not assess credit eligibility."],
    example: {
      request: "What would it take to buy 72 Wren Hollow Road with 20% down at 6.25%?",
      arguments: { property_id: "SGK-1063", down_payment_percent: 20, interest_rate_percent: 6.25, term_years: 30 },
    },
  },
  input: z.strictObject({
    property_id: propertyIdInput.optional(),
    purchase_price: z.number().positive().max(100_000_000).optional().describe("Proposed purchase price in USD."),
    down_payment_amount: z.number().nonnegative().optional().describe("Down payment in USD."),
    down_payment_percent: z.number().min(0).max(100).optional().describe("Down payment as a percentage of price."),
    interest_rate_percent: z.number().min(0).max(20).optional().describe("Annual interest rate, e.g. 6.375."),
    term_years: z.union([z.literal(10), z.literal(15), z.literal(20), z.literal(30)]).optional(),
    annual_property_tax: z.number().nonnegative().optional(),
    annual_insurance: z.number().nonnegative().optional(),
    monthly_hoa: z.number().nonnegative().optional(),
    monthly_other_costs: z.number().nonnegative().optional().describe("Utilities and other recurring costs in USD per month."),
    annual_maintenance_percent: z.number().min(0).max(5).optional().describe("Maintenance reserve as a percentage of price per year. Default 1."),
    closing_costs: z.number().nonnegative().optional().describe("Known closing costs in USD, excluding the down payment."),
    gross_monthly_income: z.number().positive().optional(),
    monthly_debt_payments: z.number().nonnegative().optional(),
    liquid_assets: z.number().nonnegative().optional(),
  }),
  output: z.object({
    property: propertyRefOutput.nullable(),
    assumptions: z.array(z.object({ field: z.string(), value: z.union([z.number(), z.string()]), basis: basisEnum })),
    acquisition_summary: z.object({
      purchase_price: moneyOutput,
      down_payment: moneyOutput,
      down_payment_percent: z.number(),
      loan_amount: moneyOutput,
      loan_to_value_percent: z.number(),
      interest_rate_percent: z.number(),
      term_years: z.int(),
    }),
    cash_required: z.object({
      down_payment: moneyOutput,
      estimated_closing_costs: moneyOutput,
      total: moneyOutput,
      closing_costs_basis: basisEnum,
    }),
    recurring_obligations: z.object({
      principal_and_interest: moneyOutput,
      property_tax: moneyOutput,
      insurance: moneyOutput,
      hoa: moneyOutput,
      mortgage_insurance: moneyOutput,
      other: moneyOutput,
      maintenance_reserve: moneyOutput,
      total_monthly: moneyOutput,
      total_annual: moneyOutput,
    }),
    financing_ratios: z.object({
      loan_to_value_percent: z.number(),
      front_end_dti_percent: z.number().nullable(),
      back_end_dti_percent: z.number().nullable(),
      reserves_after_closing_months: z.number().nullable(),
    }),
    stress_test: z.array(
      z.object({ label: z.string(), interest_rate_percent: z.number(), principal_and_interest: moneyOutput, total_monthly: moneyOutput }),
    ),
    risk_flags: z.array(z.object({ code: z.string(), severity: z.enum(["high", "medium", "low"]), message: z.string() })),
    missing_information: z.array(z.object({ field: z.string(), impact: z.string() })),
    scenario_suggestions: z.array(
      z.object({ label: z.string(), rationale: z.string(), suggested_arguments: z.record(z.string(), z.unknown()) }),
    ),
    disclaimer: z.string(),
  }),
})({
  async handler(ctx, input) {
    let property = null;
    if (input.property_id) {
      const denied = requireScopes(ctx, ["property.read"], "Using a property record in this analysis");
      if (denied) return denied;
      const resolved = await resolveProperty(ctx, input.property_id);
      if (!resolved.ok) return resolved.outcome;
      property = resolved.value;
    }

    const assumptions: { field: string; value: number | string; basis: Basis }[] = [];
    const missing: { field: string; impact: string }[] = [];
    /** Resolve a value from input, then the property record, then a documented assumption. */
    const pick = (field: string, provided: number | undefined, record: number | null, fallback: number, impact: string): number => {
      if (provided !== undefined) {
        assumptions.push({ field, value: provided, basis: "provided" });
        return provided;
      }
      if (record !== null) {
        assumptions.push({ field, value: record, basis: "record" });
        return record;
      }
      assumptions.push({ field, value: fallback, basis: "assumption" });
      missing.push({ field, impact });
      return fallback;
    };
    const fromRecord = (cents: number | null | undefined) => (cents == null ? null : cents / 100);

    const recordPrice = property ? (property.purchase_price_cents ?? property.list_price_cents) : null;
    if (input.purchase_price === undefined && recordPrice == null) {
      return {
        status: "needs_input",
        missing_fields: ["purchase_price"],
        message: "A purchase price is required, either directly or from a property record that has a list or purchase price.",
      };
    }
    const price = toCents(pick("purchase_price", input.purchase_price, fromRecord(recordPrice), 0, ""));

    let downCents: number;
    if (input.down_payment_amount !== undefined) {
      downCents = toCents(input.down_payment_amount);
      assumptions.push({ field: "down_payment_amount", value: input.down_payment_amount, basis: "provided" });
    } else {
      const percent = pick("down_payment_percent", input.down_payment_percent, null, 20, "Down payment assumed at 20%; cash required and mortgage insurance depend on it.");
      downCents = Math.round((price * percent) / 100);
    }
    if (downCents > price) {
      return { status: "needs_clarification", field: "down_payment_amount", message: "The down payment exceeds the purchase price." };
    }
    const rate = pick("interest_rate_percent", input.interest_rate_percent, null, 6.5, "Rate assumed at 6.5%; the monthly payment is highly sensitive to it.");
    const termYears = pick("term_years", input.term_years, null, 30, "Term assumed at 30 years.");
    const taxCents = toCents(
      pick("annual_property_tax", input.annual_property_tax, fromRecord(property?.annual_tax_estimate_cents), (price / 100) * 0.018, "Property tax assumed at 1.8% of price per year."),
    );
    const insCents = toCents(
      pick("annual_insurance", input.annual_insurance, fromRecord(property?.annual_insurance_estimate_cents), (price / 100) * 0.0045, "Insurance assumed at 0.45% of price per year."),
    );
    const hoaCents = toCents(pick("monthly_hoa", input.monthly_hoa, property ? (property.hoa_monthly_cents ?? 0) / 100 : null, 0, "HOA dues assumed to be none."));
    const otherCents = toCents(input.monthly_other_costs ?? 0);
    if (input.monthly_other_costs === undefined) missing.push({ field: "monthly_other_costs", impact: "Utilities and other recurring costs are excluded." });
    const maintenancePct = input.annual_maintenance_percent ?? 1;
    assumptions.push({ field: "annual_maintenance_percent", value: maintenancePct, basis: input.annual_maintenance_percent !== undefined ? "provided" : "assumption" });

    const loan = price - downCents;
    const ltv = loanToValuePercent(loan, price);
    const pi = monthlyPaymentCents(loan, rate, termYears * 12);
    const pmi = estimatedMonthlyPmiCents(loan, ltv);
    const maintenance = maintenanceReserveMonthlyCents(price, maintenancePct);
    const monthlyTax = Math.round(taxCents / 12);
    const monthlyIns = Math.round(insCents / 12);
    const housing = pi + pmi + monthlyTax + monthlyIns + hoaCents;
    const totalMonthly = housing + otherCents + maintenance;

    let closingCosts: number;
    let closingBasis: Basis;
    if (input.closing_costs !== undefined) {
      closingCosts = toCents(input.closing_costs);
      closingBasis = "provided";
    } else {
      const est = estimateCashToClose({
        purchasePriceCents: price,
        downPaymentCents: downCents,
        annualRatePercent: rate,
        closingDate: addDays(ctx.today, 45),
        annualInsuranceCents: insCents,
        annualTaxCents: taxCents,
        hoaMonthlyCents: hoaCents,
      });
      closingCosts = est.gross_cents - downCents;
      closingBasis = "assumption";
      missing.push({ field: "closing_costs", impact: "Closing costs estimated from a market fee schedule." });
    }
    const cashRequired = downCents + closingCosts;

    const income = input.gross_monthly_income ? toCents(input.gross_monthly_income) : null;
    const debts = input.monthly_debt_payments !== undefined ? toCents(input.monthly_debt_payments) : 0;
    const frontDti = income ? pct((housing / income) * 100, 1) : null;
    const backDti = income ? pct(((housing + debts) / income) * 100, 1) : null;
    const reserves = input.liquid_assets !== undefined ? pct((toCents(input.liquid_assets) - cashRequired) / totalMonthly, 1) : null;
    if (!income) missing.push({ field: "gross_monthly_income", impact: "Debt-to-income ratios cannot be calculated." });
    if (input.liquid_assets === undefined) missing.push({ field: "liquid_assets", impact: "Post-closing reserves cannot be assessed." });

    const flags: { code: string; severity: "high" | "medium" | "low"; message: string }[] = [];
    if (ltv > 80) flags.push({ code: "pmi_required", severity: "medium", message: `Loan-to-value of ${ltv}% exceeds 80%; mortgage insurance of about ${formatUsd(pmi)}/month is estimated.` });
    if (loan > 80_650_000) flags.push({ code: "jumbo_loan", severity: "low", message: "The loan exceeds the baseline conforming limit and may be priced as a jumbo loan." });
    if (backDti !== null && backDti > 43) flags.push({ code: "high_dti", severity: "high", message: `Back-end debt-to-income of ${backDti}% exceeds 43%.` });
    else if (frontDti !== null && frontDti > 28) flags.push({ code: "elevated_housing_ratio", severity: "medium", message: `Housing costs are ${frontDti}% of gross income (above 28%).` });
    if (reserves !== null && reserves < 0) flags.push({ code: "insufficient_cash", severity: "high", message: "Liquid assets do not cover the estimated cash required." });
    else if (reserves !== null && reserves < 6) flags.push({ code: "thin_reserves", severity: "medium", message: `Reserves after closing cover about ${reserves} months of costs (fewer than 6).` });
    flags.push({ code: "tax_reassessment", severity: "low", message: "Property taxes may be reassessed at the purchase price after acquisition." });

    const stress = [0, 1, 2].map((bump) => {
      const r = pct(rate + bump, 3);
      const payment = monthlyPaymentCents(loan, r, termYears * 12);
      return {
        label: bump === 0 ? "Base rate" : `Rate +${bump}%`,
        interest_rate_percent: r,
        principal_and_interest: money(payment),
        total_monthly: money(totalMonthly - pi + payment),
      };
    });

    const suggestions: { label: string; rationale: string; suggested_arguments: Record<string, unknown> }[] = [];
    if (ltv > 80) suggestions.push({ label: "Increase down payment to 20%", rationale: "Removes estimated mortgage insurance.", suggested_arguments: { down_payment_percent: 20 } });
    if (termYears === 30) suggestions.push({ label: "Compare a 15-year term", rationale: "Higher payment, substantially lower total interest.", suggested_arguments: { term_years: 15 } });
    suggestions.push({ label: "Compare financing structures", rationale: "Use compare_financing_scenarios for fixed vs adjustable rates and points.", suggested_arguments: {} });

    return {
      status: "success",
      data: {
        property: property ? propertyRef(property) : null,
        assumptions,
        acquisition_summary: {
          purchase_price: money(price),
          down_payment: money(downCents),
          down_payment_percent: pct((downCents / price) * 100, 2),
          loan_amount: money(loan),
          loan_to_value_percent: ltv,
          interest_rate_percent: rate,
          term_years: termYears,
        },
        cash_required: {
          down_payment: money(downCents),
          estimated_closing_costs: money(closingCosts),
          total: money(cashRequired),
          closing_costs_basis: closingBasis,
        },
        recurring_obligations: {
          principal_and_interest: money(pi),
          property_tax: money(monthlyTax),
          insurance: money(monthlyIns),
          hoa: money(hoaCents),
          mortgage_insurance: money(pmi),
          other: money(otherCents),
          maintenance_reserve: money(maintenance),
          total_monthly: money(totalMonthly),
          total_annual: money(totalMonthly * 12),
        },
        financing_ratios: {
          loan_to_value_percent: ltv,
          front_end_dti_percent: frontDti,
          back_end_dti_percent: backDti,
          reserves_after_closing_months: reserves,
        },
        stress_test: stress,
        risk_flags: flags,
        missing_information: missing,
        scenario_suggestions: suggestions,
        disclaimer: "Estimates for planning only. Not a loan offer, appraisal or guarantee of eligibility.",
      },
      summary: `Estimated cash required ${formatUsd(cashRequired)} and total monthly cost ${formatUsd(totalMonthly)} at ${ltv}% LTV. ${flags.length} risk flag(s); ${missing.length} value(s) assumed.`,
      warnings: missing.length ? [{ code: "assumptions_used", message: `${missing.length} value(s) were assumed. Review missing_information before relying on results.` }] : [],
    };
  },
});
