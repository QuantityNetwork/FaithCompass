import { z } from "zod";
import type { ObligationKind, ObligationRow } from "@/domain/entities";
import { addDays } from "@/domain/dates";
import { annualEquivalentCents, maintenanceReserveMonthlyCents, monthlyEquivalentCents, projectDueDates } from "@/domain/finance/cashflow";
import { formatUsd, toCents } from "@/domain/money";
import { hasScope } from "./access";
import { accountRef, money, propertyRef } from "./format";
import { operational } from "./meta";
import { resolveProperty } from "./resolve";
import { accountRefOutput, frequencyEnum, moneyOutput, obligationKindEnum, propertyIdInput, propertyRefOutput } from "./schemas";
import { defineTool, type ToolContext } from "./types";

export const OBLIGATION_LABEL: Record<ObligationKind, string> = {
  mortgage: "Mortgage",
  property_tax: "Property tax",
  insurance: "Homeowner's insurance",
  hoa: "HOA dues",
  utility_electric: "Electricity",
  utility_water: "Water",
  utility_gas: "Gas",
  internet: "Internet",
  maintenance: "Maintenance",
  other: "Other",
};

/* ───────────────────────── get_connected_accounts ───────────────────────── */

export const getConnectedAccounts = defineTool({
  name: "get_connected_accounts",
  title: "Get connected accounts",
  version: "1.0.0",
  category: "cashflow",
  executionClass: "read",
  ...operational("read"),
  owner: "sagolik-finance",
  requiredScopes: ["finance.read"],
  approvalRequired: false,
  idempotency: "none",
  providers: ["financial_data"],
  description: {
    summary: "List the financial accounts the user has connected to Sagolik, with institution, type, masked number and connection health.",
    whenToUse: ["When the user asks which accounts are connected, or you need a funding account identifier for an Autopilot plan."],
    whenNotToUse: ["To judge closing readiness — use verify_funds_readiness, which returns conclusions instead of raw balances."],
    requiredContext: ["None. Set include_balances only when the user needs balances."],
    effect: "Read-only. Returns normalized data; provider credentials and full account numbers are never exposed.",
    example: { request: "Which bank accounts are connected?", arguments: {} },
  },
  input: z.strictObject({
    include_balances: z.boolean().default(false).describe("Include current and available balances. Leave false unless balances are needed."),
  }),
  output: z.object({
    accounts: z.array(
      accountRefOutput.extend({
        type: z.string(),
        subtype: z.string(),
        liquid: z.boolean(),
        balance: z.object({ current: moneyOutput, available: moneyOutput.nullable(), as_of: z.string() }).nullable(),
      }),
    ),
    connections: z.array(z.object({ institution: z.string(), provider: z.string(), status: z.string(), last_synced_at: z.string().nullable() })),
    issues: z.array(z.object({ institution: z.string(), reason: z.string(), message: z.string() })),
  }),
})({
  async handler(ctx, input) {
    const [connections, accounts] = await Promise.all([ctx.financial.connections(), ctx.financial.accounts()]);
    return {
      status: accounts.issues.length ? "partial" : "success",
      data: {
        accounts: accounts.items.map((a) => ({
          ...accountRef(a),
          type: a.type,
          subtype: a.subtype,
          liquid: a.liquid,
          balance: input.include_balances
            ? { current: money(a.current_balance_cents), available: a.available_balance_cents === null ? null : money(a.available_balance_cents), as_of: a.balance_as_of }
            : null,
        })),
        connections: connections.map((c) => ({
          institution: c.institution_name,
          provider: ctx.financial.providerFor(c)?.label ?? c.provider_id,
          status: c.status,
          last_synced_at: c.last_synced_at,
        })),
        issues: accounts.issues.map((i) => ({ institution: i.institution, reason: i.reason, message: i.message })),
      },
      summary: `${accounts.items.length} account(s) connected across ${connections.length} institution(s)${accounts.issues.length ? `; ${accounts.issues.length} connection issue(s)` : ""}.`,
    };
  },
});

/* ───────────────────────── analyze_property_cashflow ───────────────────────── */

export const analyzePropertyCashflow = defineTool({
  name: "analyze_property_cashflow",
  title: "Analyze property cash flow",
  version: "1.0.0",
  category: "cashflow",
  executionClass: "simulate",
  ...operational("simulate"),
  owner: "sagolik-finance",
  requiredScopes: ["scenario.run", "autopilot.read"],
  approvalRequired: false,
  idempotency: "none",
  providers: [],
  description: {
    summary: "Model a property's recurring costs — mortgage, taxes, HOA, insurance, utilities and a maintenance reserve — as monthly and annual totals with a dated outlook of upcoming cash needs.",
    whenToUse: ["When the user asks what a property costs to carry, or how much cash it will need in coming months."],
    whenNotToUse: ["To automate payments — use prepare_property_autopilot.", "For a property being evaluated for purchase — use analyze_property_purchase."],
    requiredContext: ["A property_id for an owned or closing property. Optional rental income and maintenance assumptions."],
    effect: "Simulation only. Nothing is stored and no records change.",
    limitations: ["Escrowed items are included in the mortgage payment and shown for completeness only."],
    example: { request: "What will Mercer cost me each month after closing?", arguments: { property_id: "SGK-1042" } },
  },
  input: z.strictObject({
    property_id: propertyIdInput,
    monthly_rental_income: z.number().nonnegative().optional(),
    annual_maintenance_percent: z.number().min(0).max(5).default(1),
    horizon_days: z.int().min(30).max(365).default(90),
  }),
  output: z.object({
    property: propertyRefOutput,
    monthly: z.object({
      by_category: z.array(z.object({ kind: obligationKindEnum, label: z.string(), monthly_equivalent: moneyOutput, confidence: z.string(), escrowed: z.boolean() })),
      obligations_total: moneyOutput,
      maintenance_reserve: moneyOutput,
      total: moneyOutput,
      rental_income: moneyOutput.nullable(),
      net: moneyOutput.nullable(),
    }),
    annual_total: moneyOutput,
    upcoming: z.array(z.object({ due_date: z.string(), kind: obligationKindEnum, payee: z.string(), amount: moneyOutput, amount_is_estimate: z.boolean(), escrowed: z.boolean() })),
    cash_needs_by_month: z.array(z.object({ month: z.string(), total: moneyOutput })),
    assumptions: z.array(z.string()),
  }),
})({
  async handler(ctx, input) {
    const resolved = await resolveProperty(ctx, input.property_id, { statuses: ["owned", "closing", "under_contract"], purpose: "for cash-flow analysis" });
    if (!resolved.ok) return resolved.outcome;
    const property = resolved.value;
    const obligations = (await ctx.data.listObligations({ propertyId: property.id })).filter((o) => o.status !== "ended");
    if (obligations.length === 0) {
      return { status: "needs_clarification", field: "property_id", message: `No recurring obligations are recorded for ${property.reference}.` };
    }
    // Escrowed items are paid through the mortgage payment; exclude them from totals to avoid double counting.
    const payable = obligations.filter((o) => !o.escrowed);
    const byCategory = obligations.map((o) => ({
      kind: o.kind,
      label: OBLIGATION_LABEL[o.kind],
      monthly_equivalent: money(monthlyEquivalentCents(o.amount_cents, o.frequency)),
      confidence: o.confidence,
      escrowed: o.escrowed,
    }));
    const obligationsTotal = payable.reduce((acc, o) => acc + monthlyEquivalentCents(o.amount_cents, o.frequency), 0);
    const value = property.purchase_price_cents ?? property.list_price_cents ?? 0;
    const maintenance = maintenanceReserveMonthlyCents(value, input.annual_maintenance_percent);
    const total = obligationsTotal + maintenance;
    const rent = input.monthly_rental_income !== undefined ? toCents(input.monthly_rental_income) : null;

    const to = addDays(ctx.today, input.horizon_days);
    const upcoming = obligations
      .flatMap((o) =>
        projectDueDates(o.next_due_date, o.frequency, ctx.today, to).map((due) => ({
          due_date: due,
          kind: o.kind,
          payee: o.payee,
          amount: money(o.amount_cents),
          amount_is_estimate: o.amount_is_estimate,
          escrowed: o.escrowed,
        })),
      )
      .sort((a, b) => a.due_date.localeCompare(b.due_date));
    const months = new Map<string, number>();
    for (const u of upcoming) {
      if (!u.escrowed) months.set(u.due_date.slice(0, 7), (months.get(u.due_date.slice(0, 7)) ?? 0) + toCents(u.amount.amount));
    }

    const assumptions = [`Maintenance reserve of ${input.annual_maintenance_percent}% of value per year.`];
    if (payable.some((o) => o.amount_is_estimate)) assumptions.push("Some amounts are estimates (marked confidence: estimated).");
    if (obligations.some((o) => o.escrowed)) assumptions.push("Escrowed taxes and insurance are included in the mortgage payment and excluded from totals.");

    return {
      status: "success",
      data: {
        property: propertyRef(property),
        monthly: {
          by_category: byCategory,
          obligations_total: money(obligationsTotal),
          maintenance_reserve: money(maintenance),
          total: money(total),
          rental_income: rent === null ? null : money(rent),
          net: rent === null ? null : money(rent - total),
        },
        annual_total: money(payable.reduce((acc, o) => acc + annualEquivalentCents(o.amount_cents, o.frequency), 0) + maintenance * 12),
        upcoming,
        cash_needs_by_month: [...months.entries()].map(([month, cents]) => ({ month, total: money(cents) })),
        assumptions,
      },
      summary: `${property.reference} carries about ${formatUsd(total)}/month (${formatUsd(obligationsTotal)} obligations + ${formatUsd(maintenance)} maintenance reserve). ${upcoming.length} payment(s) due in the next ${input.horizon_days} days.`,
    };
  },
});

/* ───────────────────────── detect_recurring_property_obligations ───────────────────────── */

function normalize(value: string): string {
  return value.toLowerCase().replace(/\(sandbox\)/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function payeeMatches(obligation: ObligationRow, counterparty: string): boolean {
  const a = normalize(obligation.payee);
  const b = normalize(counterparty);
  return a === b || a.includes(b) || b.includes(a);
}

export const detectRecurringPropertyObligations = defineTool({
  name: "detect_recurring_property_obligations",
  title: "Detect recurring property obligations",
  version: "1.0.0",
  category: "cashflow",
  executionClass: "read",
  ...operational("read"),
  owner: "sagolik-autopilot",
  requiredScopes: ["autopilot.read"],
  approvalRequired: false,
  idempotency: "none",
  providers: ["financial_data"],
  description: {
    summary: "Identify the recurring costs associated with a property from Sagolik records and, with finance.read, confirm them against recurring activity in connected accounts.",
    whenToUse: ["When the user asks what they regularly pay for a property, or before preparing Autopilot."],
    whenNotToUse: ["To create or change obligations; this tool cannot."],
    requiredContext: ["A property_id."],
    effect: "Read-only. Bank activity is summarized as recurring series; individual transactions are not returned.",
    limitations: ["Detection needs at least three regular payments to the same counterparty."],
    example: { request: "What do I pay every month for Juniper Street?", arguments: { property_id: "SGK-1017" } },
  },
  input: z.strictObject({ property_id: propertyIdInput }),
  output: z.object({
    property: propertyRefOutput,
    obligations: z.array(
      z.object({
        obligation_id: z.string(),
        kind: obligationKindEnum,
        payee: z.string(),
        amount: moneyOutput,
        frequency: frequencyEnum,
        next_due_date: z.string().nullable(),
        confidence: z.string(),
        source: z.string(),
        escrowed: z.boolean(),
        bank_activity: z.object({ occurrences: z.int(), typical_amount: moneyOutput, last_paid_on: z.string(), account: z.string() }).nullable(),
      }),
    ),
    unlinked_recurring_activity: z.array(z.object({ counterparty: z.string(), frequency: frequencyEnum, typical_amount: moneyOutput, next_expected: z.string() })),
    gaps: z.array(z.object({ kind: obligationKindEnum, message: z.string() })),
    bank_activity_evaluated: z.boolean(),
  }),
})({
  async handler(ctx, input) {
    const resolved = await resolveProperty(ctx, input.property_id);
    if (!resolved.ok) return resolved.outcome;
    const property = resolved.value;
    const obligations = await ctx.data.listObligations({ propertyId: property.id });
    const allObligations = await ctx.data.listObligations();

    const canReadBank = hasScope(ctx, "finance.read");
    const streams = canReadBank ? await ctx.financial.recurring() : { items: [], issues: [] };
    const accounts = canReadBank ? (await ctx.financial.accounts()).items : [];
    const accountLabel = (id: string) => {
      const a = accounts.find((x) => x.id === id);
      return a ? `${a.name} ••${a.mask}` : "Connected account";
    };

    const rows = obligations.map((o) => {
      const s = streams.items.find((st) => payeeMatches(o, st.counterparty));
      return {
        obligation_id: o.id,
        kind: o.kind,
        payee: o.payee,
        amount: money(o.amount_cents),
        frequency: o.frequency,
        next_due_date: o.next_due_date,
        confidence: s && o.confidence === "estimated" ? "detected" : o.confidence,
        source: o.source,
        escrowed: o.escrowed,
        bank_activity: s ? { occurrences: s.occurrences, typical_amount: money(s.typical_amount_cents), last_paid_on: s.last_date, account: accountLabel(s.account_id) } : null,
      };
    });
    const unlinked = streams.items
      .filter((st) => !allObligations.some((o) => payeeMatches(o, st.counterparty)))
      .map((st) => ({ counterparty: st.counterparty, frequency: st.frequency, typical_amount: money(st.typical_amount_cents), next_expected: st.next_expected }));

    const gaps: { kind: ObligationKind; message: string }[] = [];
    const kinds = new Set(obligations.map((o) => o.kind));
    if (!kinds.has("insurance")) gaps.push({ kind: "insurance", message: "No homeowner's insurance obligation is recorded." });
    if (!kinds.has("property_tax")) gaps.push({ kind: "property_tax", message: "No property-tax obligation is recorded." });
    if (property.hoa_name && !kinds.has("hoa")) gaps.push({ kind: "hoa", message: `${property.hoa_name} dues are not recorded as an obligation.` });

    return {
      status: canReadBank ? "success" : "partial",
      data: { property: propertyRef(property), obligations: rows, unlinked_recurring_activity: unlinked, gaps, bank_activity_evaluated: canReadBank },
      summary: `${rows.length} recurring obligation(s) for ${property.reference}${canReadBank ? `, ${rows.filter((r) => r.bank_activity).length} confirmed by bank activity` : ""}. ${gaps.length} gap(s).`,
      warnings: canReadBank ? [] : [{ code: "bank_activity_not_evaluated", message: "Bank activity was not evaluated because finance.read is not granted." }],
    };
  },
});

/* ───────────────────────── get_upcoming_property_obligations ───────────────────────── */

export const getUpcomingPropertyObligations = defineTool({
  name: "get_upcoming_property_obligations",
  title: "Get upcoming property obligations",
  version: "1.0.0",
  category: "cashflow",
  executionClass: "read",
  ...operational("read"),
  owner: "sagolik-autopilot",
  requiredScopes: ["autopilot.read"],
  approvalRequired: false,
  idempotency: "none",
  providers: [],
  description: {
    summary: "List property payments coming due within a window, across one or all properties, with Autopilot coverage for each.",
    whenToUse: ["When the user asks what is due soon, or what to budget for in the coming weeks."],
    whenNotToUse: ["To pay or schedule anything — use prepare_recurring_property_payments."],
    requiredContext: ["Optional property_id (all properties when omitted) and a window in days."],
    effect: "Read-only.",
    example: { request: "What property bills are due in the next month?", arguments: { days: 30 } },
  },
  input: z.strictObject({ property_id: propertyIdInput.optional(), days: z.int().min(7).max(365).default(60) }),
  output: z.object({
    window: z.object({ from: z.string(), to: z.string() }),
    items: z.array(
      z.object({
        due_date: z.string(),
        property: z.string(),
        kind: obligationKindEnum,
        payee: z.string(),
        amount: moneyOutput,
        amount_is_estimate: z.boolean(),
        escrowed: z.boolean(),
        autopilot: z.object({ covered: z.boolean(), action: z.string().nullable(), status: z.string().nullable() }),
      }),
    ),
    total_due: moneyOutput,
  }),
})({
  async handler(ctx, input) {
    let propertyIds: string[] | null = null;
    if (input.property_id) {
      const resolved = await resolveProperty(ctx, input.property_id);
      if (!resolved.ok) return resolved.outcome;
      propertyIds = [resolved.value.id];
    }
    const properties = await ctx.data.listProperties();
    const refs = new Map(properties.map((p) => [p.id, p.reference]));
    const obligations = (await ctx.data.listObligations()).filter((o) => o.status !== "ended" && (!propertyIds || propertyIds.includes(o.property_id)));
    const rules = await ctx.data.listAutopilotRules({});
    const to = addDays(ctx.today, input.days);
    const items = obligations
      .flatMap((o) => {
        const rule = rules.find((r) => r.obligation_id === o.id && r.status !== "disabled");
        return projectDueDates(o.next_due_date, o.frequency, ctx.today, to).map((due) => ({
          due_date: due,
          property: refs.get(o.property_id) ?? o.property_id,
          kind: o.kind,
          payee: o.payee,
          amount: money(o.amount_cents),
          amount_is_estimate: o.amount_is_estimate,
          escrowed: o.escrowed,
          autopilot: { covered: !!rule && rule.status === "active", action: rule?.action ?? null, status: rule?.status ?? null },
        }));
      })
      .sort((a, b) => a.due_date.localeCompare(b.due_date));
    const total = items.reduce((acc, i) => acc + (i.escrowed ? 0 : toCents(i.amount.amount)), 0);
    return {
      status: "success",
      data: {
        window: { from: ctx.today, to },
        items,
        total_due: money(total),
      },
      summary: `${items.length} payment(s) due by ${to}, totaling ${formatUsd(total)} excluding escrowed items.`,
    };
  },
});

export async function accountLabelFor(ctx: ToolContext, accountId: string | null): Promise<{ id: string; label: string } | null> {
  if (!accountId) return null;
  const accounts = (await ctx.financial.accounts()).items;
  const a = accounts.find((x) => x.id === accountId);
  return a ? { id: a.id, label: `${a.name} ••${a.mask}` } : null;
}
