import { z } from "zod";
import type { HomebookCategory } from "@/domain/entities";
import { HOMEBOOK_CATEGORIES } from "@/domain/entities";
import { addMonths, daysBetween } from "@/domain/dates";
import { monthlyEquivalentCents } from "@/domain/finance/cashflow";
import { remainingBalanceCents } from "@/domain/finance/mortgage";
import { formatUsd } from "@/domain/money";
import { hasScope, restricted } from "./access";
import { money, moneyOrNull, propertyRef } from "./format";
import { operational } from "./meta";
import { resolveProperty } from "./resolve";
import { moneyOutput, propertyIdInput, propertyRefOutput, restrictedSection } from "./schemas";
import { defineTool } from "./types";

const section = <T extends z.ZodType>(schema: T) => z.union([schema, restrictedSection]);

const HOMEBOOK_LABEL: Record<HomebookCategory, string> = {
  purchase: "Purchase records",
  warranty: "Warranties",
  invoice: "Invoices",
  renovation: "Renovations",
  inspection: "Inspections",
  maintenance: "Maintenance",
  ownership_document: "Ownership documents",
  insurance: "Insurance",
  tax: "Tax records",
};

/* ───────────────────────── get_ownership_profile ───────────────────────── */

export const getOwnershipProfile = defineTool({
  name: "get_ownership_profile",
  title: "Get ownership profile",
  version: "1.0.0",
  category: "ownership",
  executionClass: "read",
  ...operational("read"),
  owner: "sagolik-ownership",
  requiredScopes: ["ownership.read"],
  approvalRequired: false,
  idempotency: "none",
  providers: [],
  description: {
    summary: "Return the ownership profile of a property after closing: ownership date, vesting, financing, recurring obligations, insurance, taxes, documents, maintenance and automation status.",
    whenToUse: ["When the user asks about a property they own — its loan, costs, insurance, taxes or upkeep."],
    whenNotToUse: ["For a property still in closing — use get_closing_status.", "For the detailed record history — use get_property_homebook."],
    requiredContext: ["A property_id for an owned property."],
    effect: "Read-only. Sections outside the connection's scopes are returned as restricted.",
    example: { request: "Give me the ownership summary for Juniper Street.", arguments: { property_id: "SGK-1017" } },
  },
  input: z.strictObject({ property_id: propertyIdInput }),
  output: z.object({
    property: propertyRefOutput,
    ownership_status: z.enum(["owned", "pending_closing", "not_owned"]),
    ownership: z
      .object({
        ownership_date: z.string(),
        years_owned: z.number(),
        vesting: z.string(),
        title_company: z.string().nullable(),
        deed_recorded_on: z.string().nullable(),
        purchase_price: moneyOutput.nullable(),
      })
      .nullable(),
    financing: section(
      z
        .object({
          lender: z.string(),
          original_principal: moneyOutput,
          interest_rate_percent: z.number(),
          term_months: z.int(),
          monthly_principal_interest: moneyOutput,
          escrow_included: z.boolean(),
          estimated_balance: moneyOutput,
        })
        .nullable(),
    ),
    recurring_obligations: section(z.object({ count: z.int(), monthly_equivalent: moneyOutput })),
    insurance: z.object({ carrier: z.string().nullable(), annual_premium: moneyOutput.nullable(), renews_on: z.string().nullable(), escrowed: z.boolean() }),
    taxes: z.object({ jurisdiction: z.string().nullable(), annual_amount: moneyOutput.nullable(), next_due: z.string().nullable(), escrowed: z.boolean() }),
    documents: section(z.object({ total: z.int(), categories: z.array(z.string()) })),
    maintenance: z.object({ last_service: z.string().nullable(), active_warranties: z.int(), expiring_soon: z.array(z.object({ title: z.string(), expires_on: z.string() })) }),
    automation: section(z.object({ enabled: z.boolean(), active_rules: z.int(), failed_rules: z.int() })),
  }),
})({
  async handler(ctx, input) {
    const resolved = await resolveProperty(ctx, input.property_id);
    if (!resolved.ok) return resolved.outcome;
    const property = resolved.value;
    const record = await ctx.data.getOwnershipRecord(property.id);
    const status = record ? "owned" : property.status === "closing" || property.status === "under_contract" ? "pending_closing" : "not_owned";

    const [obligations, homebook] = await Promise.all([ctx.data.listObligations({ propertyId: property.id }), ctx.data.listHomebookEntries(property.id)]);
    const insuranceOb = obligations.find((o) => o.kind === "insurance");
    const taxOb = obligations.find((o) => o.kind === "property_tax");

    let financing;
    if (!hasScope(ctx, "transaction.read")) financing = restricted("transaction.read", "Financing requires transaction.read.");
    else {
      const loan = (await ctx.data.listLoans({ propertyId: property.id })).find((l) => l.status === "active") ?? null;
      if (loan && record) {
        const firstPayment = addMonths(`${record.ownership_date.slice(0, 8)}01`, 2);
        const monthsPaid = Math.max(0, Math.floor(daysBetween(firstPayment, ctx.today) / 30.4375) + 1);
        financing = {
          lender: loan.lender_name,
          original_principal: money(loan.principal_cents),
          interest_rate_percent: loan.annual_rate_percent,
          term_months: loan.term_months,
          monthly_principal_interest: money(loan.monthly_principal_interest_cents),
          escrow_included: loan.escrow_included,
          estimated_balance: money(remainingBalanceCents(loan.principal_cents, loan.annual_rate_percent, loan.term_months, monthsPaid)),
        };
      } else financing = null;
    }

    const recurring = hasScope(ctx, "autopilot.read")
      ? {
          count: obligations.filter((o) => o.status === "active").length,
          monthly_equivalent: money(obligations.filter((o) => o.status === "active" && !o.escrowed).reduce((acc, o) => acc + monthlyEquivalentCents(o.amount_cents, o.frequency), 0)),
        }
      : restricted("autopilot.read", "Obligations require autopilot.read.");

    const documents = hasScope(ctx, "documents.read")
      ? await ctx.data.listDocuments({ propertyId: property.id }).then((docs) => ({ total: docs.length, categories: [...new Set(docs.map((d) => d.category))] }))
      : restricted("documents.read", "Documents require documents.read.");

    const automation = hasScope(ctx, "autopilot.read")
      ? await ctx.data.listAutopilotRules({ propertyId: property.id }).then((rules) => ({
          enabled: rules.some((r) => r.status === "active"),
          active_rules: rules.filter((r) => r.status === "active").length,
          failed_rules: rules.filter((r) => r.status === "failed").length,
        }))
      : restricted("autopilot.read", "Automation status requires autopilot.read.");

    const maintenanceEntries = homebook.filter((h) => h.category === "maintenance").sort((a, b) => b.occurred_on.localeCompare(a.occurred_on));
    const warranties = homebook.filter((h) => h.category === "warranty" && h.expires_on && h.expires_on >= ctx.today);
    const expiring = warranties.filter((h) => daysBetween(ctx.today, h.expires_on!) <= 90);

    const yearsOwned = record ? Math.round((daysBetween(record.ownership_date, ctx.today) / 365.25) * 10) / 10 : 0;
    return {
      status: record ? "success" : "partial",
      data: {
        property: propertyRef(property),
        ownership_status: status,
        ownership: record
          ? {
              ownership_date: record.ownership_date,
              years_owned: yearsOwned,
              vesting: record.vesting,
              title_company: record.title_company,
              deed_recorded_on: record.deed_recorded_on,
              purchase_price: moneyOrNull(record.purchase_price_cents),
            }
          : null,
        financing,
        recurring_obligations: recurring,
        insurance: {
          carrier: insuranceOb?.payee ?? null,
          annual_premium: moneyOrNull(insuranceOb?.amount_cents ?? property.annual_insurance_estimate_cents),
          renews_on: insuranceOb?.next_due_date ?? null,
          escrowed: insuranceOb?.escrowed ?? false,
        },
        taxes: {
          jurisdiction: property.tax_jurisdiction,
          annual_amount: moneyOrNull(taxOb?.amount_cents ?? property.annual_tax_estimate_cents),
          next_due: taxOb?.next_due_date ?? null,
          escrowed: taxOb?.escrowed ?? false,
        },
        documents,
        maintenance: {
          last_service: maintenanceEntries[0]?.occurred_on ?? null,
          active_warranties: warranties.length,
          expiring_soon: expiring.map((h) => ({ title: h.title, expires_on: h.expires_on! })),
        },
        automation,
      },
      summary: record
        ? `${property.reference} owned since ${record.ownership_date} (${yearsOwned} years, ${record.vesting.toLowerCase()} vesting).${expiring.length ? ` ${expiring.length} warranty item(s) expiring within 90 days.` : ""}`
        : `${property.reference} is not yet owned (${status.replace("_", " ")}). An ownership profile is created when the deed is recorded.`,
      warnings: record ? [] : [{ code: "not_owned", message: "Ownership has not begun; most ownership fields are empty." }],
    };
  },
});

/* ───────────────────────── get_property_homebook ───────────────────────── */

export const getPropertyHomebook = defineTool({
  name: "get_property_homebook",
  title: "Get property homebook",
  version: "1.0.0",
  category: "ownership",
  executionClass: "read",
  ...operational("read"),
  owner: "sagolik-ownership",
  requiredScopes: ["ownership.read"],
  approvalRequired: false,
  idempotency: "none",
  providers: [],
  description: {
    summary: "Return the property homebook — the persistent record of purchase records, warranties, invoices, renovations, inspections, maintenance, ownership documents, insurance and tax records.",
    whenToUse: ["When the user asks about a property's history, warranties, past work or records."],
    whenNotToUse: ["For current costs — use analyze_property_cashflow."],
    requiredContext: ["A property_id. Optional category filter."],
    effect: "Read-only. Returns entry metadata; attached files are never exposed.",
    example: { request: "When was the HVAC last serviced at Juniper?", arguments: { property_id: "SGK-1017", category: "maintenance" } },
  },
  input: z.strictObject({ property_id: propertyIdInput, category: z.enum(HOMEBOOK_CATEGORIES).optional() }),
  output: z.object({
    property: propertyRefOutput,
    entries_total: z.int(),
    sections: z.array(
      z.object({
        category: z.enum(HOMEBOOK_CATEGORIES),
        label: z.string(),
        entries: z.array(
          z.object({
            entry_id: z.string(),
            title: z.string(),
            occurred_on: z.string(),
            amount: moneyOutput.nullable(),
            vendor: z.string().nullable(),
            expires_on: z.string().nullable(),
            notes: z.string().nullable(),
            has_document: z.boolean(),
          }),
        ),
      }),
    ),
    expiring_soon: z.array(z.object({ title: z.string(), expires_on: z.string(), days_remaining: z.int() })),
  }),
})({
  async handler(ctx, input) {
    const resolved = await resolveProperty(ctx, input.property_id);
    if (!resolved.ok) return resolved.outcome;
    const property = resolved.value;
    const entries = (await ctx.data.listHomebookEntries(property.id)).filter((e) => !input.category || e.category === input.category);
    if (entries.length === 0 && !input.category) {
      return {
        status: "success",
        data: { property: propertyRef(property), entries_total: 0, sections: [], expiring_soon: [] },
        summary: `The homebook for ${property.reference} is empty. It is populated as records are added after ownership begins.`,
      };
    }
    const sections = HOMEBOOK_CATEGORIES.filter((c) => entries.some((e) => e.category === c)).map((category) => ({
      category,
      label: HOMEBOOK_LABEL[category],
      entries: entries
        .filter((e) => e.category === category)
        .sort((a, b) => b.occurred_on.localeCompare(a.occurred_on))
        .map((e) => ({
          entry_id: e.id,
          title: e.title,
          occurred_on: e.occurred_on,
          amount: moneyOrNull(e.amount_cents),
          vendor: e.vendor,
          expires_on: e.expires_on,
          notes: e.notes,
          has_document: e.document_id !== null,
        })),
    }));
    const expiring = entries
      .filter((e) => e.expires_on && e.expires_on >= ctx.today && daysBetween(ctx.today, e.expires_on) <= 90)
      .map((e) => ({ title: e.title, expires_on: e.expires_on!, days_remaining: daysBetween(ctx.today, e.expires_on!) }));
    const spend = entries.reduce((acc, e) => acc + (e.category === "renovation" || e.category === "maintenance" || e.category === "invoice" ? (e.amount_cents ?? 0) : 0), 0);
    return {
      status: "success",
      data: { property: propertyRef(property), entries_total: entries.length, sections, expiring_soon: expiring },
      summary: `${entries.length} homebook entr${entries.length === 1 ? "y" : "ies"} for ${property.reference}${spend ? `; ${formatUsd(spend)} recorded in upkeep and improvements` : ""}.${expiring.length ? ` ${expiring.length} item(s) expiring within 90 days.` : ""}`,
    };
  },
});
