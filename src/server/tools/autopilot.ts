import { z } from "zod";
import type { AutopilotAction, AutopilotPlanItem, AutopilotRuleRow, ObligationKind, ObligationRow, PropertyRow } from "@/domain/entities";
import { OBLIGATION_KINDS } from "@/domain/entities";
import { addDays } from "@/domain/dates";
import { monthlyEquivalentCents, projectDueDates } from "@/domain/finance/cashflow";
import { formatUsd } from "@/domain/money";
import type { NormalizedAccount } from "@/server/integrations/financial/types";
import { hasScope } from "./access";
import { OBLIGATION_LABEL } from "./cashflow";
import { accountRef, money, propertyLabel, propertyRef } from "./format";
import { operational } from "./meta";
import { resolveProperty } from "./resolve";
import {
  accountRefOutput,
  approvalIdInput,
  frequencyEnum,
  idempotencyKeyInput,
  moneyOutput,
  obligationKindEnum,
  propertyIdInput,
  propertyRefOutput,
} from "./schemas";
import { defineTool, type NonSuccessOutcome, type ToolContext, type ToolWarning } from "./types";

const PLAN_TTL_DAYS = 7;
const actionEnum = z.enum(["track", "remind", "schedule_payment"]);

/** Conservative default automation for one obligation. Anything uncertain becomes a reminder. */
export function proposeAction(o: ObligationRow): { action: AutopilotAction; lead_days: number; rationale: string } {
  const annualish = o.frequency !== "monthly";
  if (o.escrowed) return { action: "track", lead_days: 30, rationale: "Paid through the mortgage escrow account; Sagolik tracks it to confirm payment." };
  if (!o.payee_verified) return { action: "remind", lead_days: annualish ? 30 : 7, rationale: "Payment destination is not verified; reminders only until it is verified." };
  if (o.amount_is_estimate) return { action: "remind", lead_days: annualish ? 30 : 5, rationale: "Amount varies or is estimated; you confirm each payment." };
  return { action: "schedule_payment", lead_days: annualish ? 10 : 3, rationale: "Fixed amount to a verified payee." };
}

const planItemOutput = z.object({
  obligation_id: z.string(),
  kind: obligationKindEnum,
  label: z.string(),
  payee: z.string(),
  amount: moneyOutput,
  amount_is_estimate: z.boolean(),
  frequency: frequencyEnum,
  next_due_date: z.string().nullable(),
  action: actionEnum,
  lead_days: z.int(),
  rationale: z.string(),
});

const planOutput = z.object({
  plan_id: z.string(),
  status: z.literal("draft"),
  kind: z.enum(["autopilot", "recurring_payments"]),
  property: propertyRefOutput,
  funding_account: accountRefOutput.nullable(),
  items: z.array(planItemOutput),
  coverage: z.object({ schedule_payment: z.int(), remind: z.int(), track: z.int() }),
  scheduled_monthly_total: moneyOutput,
  unresolved: z.array(z.object({ kind: obligationKindEnum, reason: z.string() })),
  activation: z.object({ tool: z.literal("activate_property_autopilot"), required_scope: z.literal("autopilot.execute"), requires_approval: z.literal(true), execution_mode: z.enum(["simulated", "reminder_only"]) }),
  expires_at: z.string(),
  note: z.string(),
});

const itemView = (i: AutopilotPlanItem) => ({
  obligation_id: i.obligation_id,
  kind: i.kind,
  label: OBLIGATION_LABEL[i.kind],
  payee: i.payee,
  amount: money(i.amount_cents),
  amount_is_estimate: i.amount_is_estimate,
  frequency: i.frequency,
  next_due_date: i.next_due_date,
  action: i.action,
  lead_days: i.lead_days,
  rationale: i.rationale,
});

async function liquidAccounts(ctx: ToolContext): Promise<NormalizedAccount[]> {
  return (await ctx.financial.accounts()).items.filter((a) => a.liquid);
}

/** Resolve the funding account for scheduled payments. Never chooses one on the user's behalf. */
async function resolveFundingAccount(ctx: ToolContext, requested: string | undefined): Promise<{ ok: true; account: NormalizedAccount } | { ok: false; outcome: NonSuccessOutcome }> {
  const accounts = await liquidAccounts(ctx);
  const options = accounts.map((a) => ({ value: a.id, label: `${a.name} ••${a.mask}`, description: `${a.institution} · ${a.subtype}` }));
  if (!requested) {
    return {
      ok: false,
      outcome: accounts.length
        ? { status: "needs_clarification", field: "funding_account_id", message: "Scheduled payments need a funding account. Ask the user which account to use, then call again with funding_account_id.", options }
        : { status: "needs_clarification", field: "funding_account_id", message: "No eligible funding account is connected. The user must connect a checking or savings account first." },
    };
  }
  const account = accounts.find((a) => a.id === requested);
  if (!account) {
    return { ok: false, outcome: { status: "needs_clarification", field: "funding_account_id", message: "That funding account is not an eligible connected account. Do not guess account identifiers.", options } };
  }
  return { ok: true, account };
}

async function savePlan(
  ctx: ToolContext,
  property: PropertyRow,
  kind: "autopilot" | "recurring_payments",
  items: AutopilotPlanItem[],
  funding: NormalizedAccount | null,
  unresolved: { kind: ObligationKind; reason: string }[],
) {
  const id = ctx.newId();
  const now = ctx.now.toISOString();
  const expiresAt = new Date(ctx.now.getTime() + PLAN_TTL_DAYS * 86_400_000).toISOString();
  const scheduled = items.filter((i) => i.action === "schedule_payment");
  const scheduledMonthly = scheduled.reduce((acc, i) => acc + monthlyEquivalentCents(i.amount_cents, i.frequency), 0);
  const summary = `${items.length} obligation(s): ${scheduled.length} scheduled payment(s), ${items.filter((i) => i.action === "remind").length} reminder(s), ${items.filter((i) => i.action === "track").length} tracked.`;
  await ctx.data.insertAutopilotPlan({
    id,
    organization_id: ctx.organizationId,
    environment: ctx.environment,
    property_id: property.id,
    kind,
    status: "draft",
    items,
    funding_account_id: funding?.id ?? null,
    summary,
    prepared_by_connection_id: ctx.client.connectionId,
    approval_id: null,
    expires_at: expiresAt,
    activated_at: null,
    created_at: now,
    updated_at: now,
  });
  const view = {
    plan_id: id,
    status: "draft" as const,
    kind,
    property: propertyRef(property),
    funding_account: funding ? accountRef(funding) : null,
    items: items.map(itemView),
    coverage: {
      schedule_payment: scheduled.length,
      remind: items.filter((i) => i.action === "remind").length,
      track: items.filter((i) => i.action === "track").length,
    },
    scheduled_monthly_total: money(scheduledMonthly),
    unresolved,
    activation: {
      tool: "activate_property_autopilot" as const,
      required_scope: "autopilot.execute" as const,
      requires_approval: true as const,
      execution_mode: ctx.payments ? ("simulated" as const) : ("reminder_only" as const),
    },
    expires_at: expiresAt,
    note: "Proposed plan only. Nothing is active and no payment instruction exists until the plan is approved and activated.",
  };
  return { view, scheduledMonthlyCents: scheduledMonthly };
}

/* ───────────────────────── inspect_property_obligations ───────────────────────── */

export const inspectPropertyObligations = defineTool({
  name: "inspect_property_obligations",
  title: "Inspect property obligations",
  version: "1.0.0",
  category: "autopilot",
  executionClass: "read",
  ...operational("read"),
  owner: "sagolik-autopilot",
  requiredScopes: ["autopilot.read"],
  approvalRequired: false,
  idempotency: "none",
  providers: [],
  description: {
    summary: "Inspect every recurring obligation of a property — amount, cadence, due date, escrow, payee verification — and its current Autopilot coverage.",
    whenToUse: ["Before preparing Autopilot, or when the user asks what a property requires them to pay and whether it is handled."],
    whenNotToUse: ["To create automation — use prepare_property_autopilot."],
    requiredContext: ["A property_id for an owned property or one in closing."],
    effect: "Read-only.",
    example: { request: "What does Mercer require me to pay once I own it?", arguments: { property_id: "SGK-1042" } },
  },
  input: z.strictObject({ property_id: propertyIdInput }),
  output: z.object({
    property: propertyRefOutput,
    ownership_status: z.enum(["owned", "pre_closing", "other"]),
    obligations: z.array(
      z.object({
        obligation_id: z.string(),
        kind: obligationKindEnum,
        label: z.string(),
        payee: z.string(),
        amount: moneyOutput,
        amount_is_estimate: z.boolean(),
        frequency: frequencyEnum,
        monthly_equivalent: moneyOutput,
        next_due_date: z.string().nullable(),
        escrowed: z.boolean(),
        confidence: z.string(),
        payee_verified: z.boolean(),
        status: z.string(),
        autopilot: z.object({ action: actionEnum, status: z.string(), execution_mode: z.string() }).nullable(),
      }),
    ),
    totals: z.object({ monthly_equivalent: moneyOutput, annual: moneyOutput }),
    coverage: z.object({ covered: z.int(), total: z.int(), uncovered: z.array(z.string()) }),
    issues: z.array(z.object({ obligation_id: z.string(), code: z.string(), message: z.string() })),
  }),
})({
  async handler(ctx, input) {
    const resolved = await resolveProperty(ctx, input.property_id);
    if (!resolved.ok) return resolved.outcome;
    const property = resolved.value;
    const [obligations, rules] = await Promise.all([ctx.data.listObligations({ propertyId: property.id }), ctx.data.listAutopilotRules({ propertyId: property.id })]);
    const live = obligations.filter((o) => o.status !== "ended");
    const ruleFor = (o: ObligationRow) => rules.find((r) => r.obligation_id === o.id && r.status !== "disabled") ?? null;
    const issues: { obligation_id: string; code: string; message: string }[] = [];
    for (const o of live) {
      const rule = ruleFor(o);
      if (rule?.status === "failed") issues.push({ obligation_id: o.id, code: "automation_failed", message: rule.failure_reason ?? "Automation failed." });
      if (!o.payee_verified && !o.escrowed) issues.push({ obligation_id: o.id, code: "payee_unverified", message: `The payment destination for ${o.payee} is not verified.` });
      if (o.amount_is_estimate) issues.push({ obligation_id: o.id, code: "estimated_amount", message: `${OBLIGATION_LABEL[o.kind]} amount is an estimate.` });
    }
    const monthly = live.filter((o) => !o.escrowed).reduce((acc, o) => acc + monthlyEquivalentCents(o.amount_cents, o.frequency), 0);
    const covered = live.filter((o) => ruleFor(o)?.status === "active");
    return {
      status: "success",
      data: {
        property: propertyRef(property),
        ownership_status: property.status === "owned" ? "owned" : property.status === "closing" || property.status === "under_contract" ? "pre_closing" : "other",
        obligations: live.map((o) => {
          const rule = ruleFor(o);
          return {
            obligation_id: o.id,
            kind: o.kind,
            label: OBLIGATION_LABEL[o.kind],
            payee: o.payee,
            amount: money(o.amount_cents),
            amount_is_estimate: o.amount_is_estimate,
            frequency: o.frequency,
            monthly_equivalent: money(monthlyEquivalentCents(o.amount_cents, o.frequency)),
            next_due_date: o.next_due_date,
            escrowed: o.escrowed,
            confidence: o.confidence,
            payee_verified: o.payee_verified,
            status: o.status,
            autopilot: rule ? { action: rule.action, status: rule.status, execution_mode: rule.execution_mode } : null,
          };
        }),
        totals: { monthly_equivalent: money(monthly), annual: money(monthly * 12) },
        coverage: { covered: covered.length, total: live.length, uncovered: live.filter((o) => !covered.includes(o)).map((o) => OBLIGATION_LABEL[o.kind]) },
        issues,
      },
      summary: `${property.reference} has ${live.length} obligation(s) totaling about ${formatUsd(monthly)}/month (excluding escrow). Autopilot covers ${covered.length} of ${live.length}. ${issues.length} issue(s).`,
    };
  },
});

/* ───────────────────────── prepare_property_autopilot ───────────────────────── */

export const preparePropertyAutopilot = defineTool({
  name: "prepare_property_autopilot",
  title: "Prepare property Autopilot",
  version: "1.0.0",
  category: "autopilot",
  executionClass: "prepare",
  ...operational("prepare"),
  owner: "sagolik-autopilot",
  requiredScopes: ["autopilot.read", "autopilot.prepare"],
  approvalRequired: false,
  idempotency: "key",
  providers: ["financial_data"],
  description: {
    summary: "Create a proposed Autopilot plan for a property: which obligations to schedule, remind about or track, from which funding account. The plan is a draft for human review.",
    whenToUse: ["When the user asks Sagolik to take care of a property's recurring obligations."],
    whenNotToUse: [
      "To activate automation — activation requires activate_property_autopilot, autopilot.execute and human approval.",
      "To preview obligations only — use inspect_property_obligations.",
    ],
    requiredContext: [
      "A property_id for an owned property or one in closing.",
      "A funding_account_id when any payment would be scheduled. If omitted, Sagolik returns needs_clarification with eligible accounts — ask the user; never choose for them.",
    ],
    effect: "Creates a draft plan in Sagolik that expires after 7 days. No automation is active and no payment instruction exists.",
    limitations: ["Obligations with estimated amounts or unverified payees are proposed as reminders, never scheduled payments."],
    example: { request: "Prepare autopilot for this property.", arguments: { property_id: "SGK-1042", funding_account_id: "<account id from get_connected_accounts>" } },
  },
  input: z.strictObject({
    property_id: propertyIdInput,
    funding_account_id: z.string().min(1).max(128).optional().describe("account_id of a connected checking or savings account, from get_connected_accounts."),
    include_kinds: z.array(z.enum(OBLIGATION_KINDS)).min(1).optional().describe("Limit the plan to these obligation kinds."),
    idempotency_key: idempotencyKeyInput,
  }),
  output: planOutput,
})({
  async handler(ctx, input) {
    const resolved = await resolveProperty(ctx, input.property_id, { statuses: ["owned", "closing", "under_contract"], purpose: "for Autopilot" });
    if (!resolved.ok) return resolved.outcome;
    const property = resolved.value;
    const [obligations, rules] = await Promise.all([ctx.data.listObligations({ propertyId: property.id }), ctx.data.listAutopilotRules({ propertyId: property.id })]);
    const activeRule = (o: ObligationRow) => rules.find((r) => r.obligation_id === o.id && r.status === "active");
    const candidates = obligations.filter((o) => o.status !== "ended" && !activeRule(o) && (!input.include_kinds || input.include_kinds.includes(o.kind)));
    if (candidates.length === 0) {
      return {
        status: "needs_clarification",
        field: "include_kinds",
        message: obligations.length ? "Every selected obligation is already covered by active Autopilot rules." : `No obligations are recorded for ${property.reference}.`,
      };
    }

    const warnings: ToolWarning[] = [];
    const proposals = candidates.map((o) => ({ o, ...proposeAction(o) }));
    let funding: NormalizedAccount | null = null;
    if (proposals.some((p) => p.action === "schedule_payment")) {
      if (!hasScope(ctx, "finance.read")) {
        for (const p of proposals) if (p.action === "schedule_payment") Object.assign(p, { action: "remind", rationale: "Scheduling needs a funding account, which requires finance.read. Reminder proposed instead." });
        warnings.push({ code: "funding_account_unavailable", message: "finance.read is not granted; payments are proposed as reminders." });
      } else {
        const f = await resolveFundingAccount(ctx, input.funding_account_id);
        if (!f.ok) return f.outcome;
        funding = f.account;
      }
    }
    const items: AutopilotPlanItem[] = proposals.map(({ o, action, lead_days, rationale }) => ({
      obligation_id: o.id,
      kind: o.kind,
      payee: o.payee,
      amount_cents: o.amount_cents,
      amount_is_estimate: o.amount_is_estimate,
      frequency: o.frequency,
      next_due_date: o.next_due_date,
      action,
      lead_days,
      funding_account_id: action === "schedule_payment" ? (funding?.id ?? null) : null,
      rationale,
    }));
    const failed = rules.filter((r) => r.status === "failed").length;
    const { view: data, scheduledMonthlyCents } = await savePlan(ctx, property, "autopilot", items, funding, []);
    return {
      status: "success",
      stateChanged: true,
      data,
      summary: `Prepared a draft Autopilot plan for ${propertyLabel(property)}: ${data.coverage.schedule_payment} scheduled payment(s) totaling ${formatUsd(scheduledMonthlyCents)}/month, ${data.coverage.remind} reminder(s), ${data.coverage.track} tracked${failed ? `, including ${failed} obligation(s) whose automation previously failed` : ""}. Activation requires approval.`,
      warnings,
      events: [{ type: "autopilot.action_required", payload: { plan_id: data.plan_id, property: property.reference, reason: "plan_ready_for_review" } }],
    };
  },
});

/* ───────────────────────── prepare_recurring_property_payments ───────────────────────── */

export const prepareRecurringPropertyPayments = defineTool({
  name: "prepare_recurring_property_payments",
  title: "Prepare recurring property payments",
  version: "1.0.0",
  category: "autopilot",
  executionClass: "prepare",
  ...operational("prepare"),
  owner: "sagolik-autopilot",
  requiredScopes: ["autopilot.prepare", "finance.read"],
  approvalRequired: false,
  idempotency: "key",
  providers: ["financial_data"],
  description: {
    summary: "Prepare recurring payment instructions for specific obligations of a property (for example HOA dues and property tax), resolving payee, amount, cadence and funding account.",
    whenToUse: ["When the user asks Sagolik to pay specific recurring property bills, e.g. \"pay the property tax\"."],
    whenNotToUse: [
      "To pay immediately or activate anything — activation requires activate_property_autopilot and approval.",
      "When the obligation, property or funding account is ambiguous — ask the user first.",
    ],
    requiredContext: [
      "A property_id and the obligation_kinds to pay.",
      "A funding_account_id. If omitted, Sagolik returns needs_clarification with eligible accounts.",
    ],
    effect: "Creates a draft payment plan. Nothing is scheduled and no funds move.",
    limitations: [
      "Escrowed obligations are excluded — they are already paid through the mortgage.",
      "Obligations with unverified payees or estimated amounts are prepared as reminders and listed as unresolved.",
    ],
    example: {
      request: "Set up HOA and property-tax payments for Mercer.",
      arguments: { property_id: "SGK-1042", obligation_kinds: ["hoa", "property_tax"], funding_account_id: "<account id>" },
    },
  },
  input: z.strictObject({
    property_id: propertyIdInput,
    obligation_kinds: z.array(z.enum(OBLIGATION_KINDS)).min(1).max(10),
    funding_account_id: z.string().min(1).max(128).optional(),
    idempotency_key: idempotencyKeyInput,
  }),
  output: planOutput,
})({
  async handler(ctx, input) {
    const resolved = await resolveProperty(ctx, input.property_id, { statuses: ["owned", "closing", "under_contract"], purpose: "for recurring payments" });
    if (!resolved.ok) return resolved.outcome;
    const property = resolved.value;
    const obligations = (await ctx.data.listObligations({ propertyId: property.id })).filter((o) => o.status !== "ended");
    const unresolved: { kind: ObligationKind; reason: string }[] = [];
    const selected: ObligationRow[] = [];
    for (const kind of new Set(input.obligation_kinds)) {
      const matches = obligations.filter((o) => o.kind === kind);
      if (matches.length === 0) unresolved.push({ kind, reason: `No ${OBLIGATION_LABEL[kind].toLowerCase()} obligation is recorded for ${property.reference}.` });
      else if (matches.length > 1) unresolved.push({ kind, reason: `Multiple ${OBLIGATION_LABEL[kind].toLowerCase()} obligations exist; specify via prepare_property_autopilot with include_kinds.` });
      else if (matches[0]!.escrowed) unresolved.push({ kind, reason: "Paid through mortgage escrow; a separate payment would duplicate it." });
      else selected.push(matches[0]!);
    }
    if (selected.length === 0) {
      return {
        status: "needs_clarification",
        field: "obligation_kinds",
        message: `None of the requested obligations can be prepared: ${unresolved.map((u) => u.reason).join(" ")}`,
        options: obligations.filter((o) => !o.escrowed).map((o) => ({ value: o.kind, label: `${OBLIGATION_LABEL[o.kind]} — ${o.payee}`, description: `${formatUsd(o.amount_cents)} ${o.frequency}` })),
      };
    }
    const f = await resolveFundingAccount(ctx, input.funding_account_id);
    if (!f.ok) return f.outcome;

    const items: AutopilotPlanItem[] = selected.map((o) => {
      const proposal = proposeAction(o);
      if (proposal.action !== "schedule_payment") unresolved.push({ kind: o.kind, reason: proposal.rationale });
      return {
        obligation_id: o.id,
        kind: o.kind,
        payee: o.payee,
        amount_cents: o.amount_cents,
        amount_is_estimate: o.amount_is_estimate,
        frequency: o.frequency,
        next_due_date: o.next_due_date,
        action: proposal.action,
        lead_days: proposal.lead_days,
        funding_account_id: proposal.action === "schedule_payment" ? f.account.id : null,
        rationale: proposal.rationale,
      };
    });
    const { view: data, scheduledMonthlyCents } = await savePlan(ctx, property, "recurring_payments", items, f.account, unresolved);
    return {
      status: unresolved.length ? "partial" : "success",
      stateChanged: true,
      data,
      summary: `Prepared recurring payments for ${propertyLabel(property)} from ${f.account.name} ••${f.account.mask}: ${data.coverage.schedule_payment} scheduled (${formatUsd(scheduledMonthlyCents)}/month), ${data.coverage.remind} reminder-only. ${unresolved.length} unresolved item(s). Activation requires approval.`,
      warnings: unresolved.map((u) => ({ code: "unresolved_obligation", message: `${OBLIGATION_LABEL[u.kind]}: ${u.reason}` })),
    };
  },
});

/* ───────────────────────── activate_property_autopilot ───────────────────────── */

async function loadActivatablePlan(ctx: ToolContext, planId: string) {
  const plan = await ctx.data.getAutopilotPlan(planId);
  if (!plan) return { ok: false as const, outcome: { status: "needs_clarification" as const, field: "plan_id", message: "No prepared plan with that plan_id exists. Use prepare_property_autopilot first." } };
  if (plan.status !== "draft" && plan.status !== "pending_approval") {
    return { ok: false as const, outcome: { status: "needs_clarification" as const, field: "plan_id", message: `This plan is ${plan.status} and cannot be activated. Prepare a new plan.` } };
  }
  if (plan.expires_at < ctx.now.toISOString()) {
    return { ok: false as const, outcome: { status: "needs_clarification" as const, field: "plan_id", message: "This plan has expired. Prepare a new plan so it reflects current obligations." } };
  }
  const property = await ctx.data.getProperty(plan.property_id);
  if (!property) throw new Error("Plan references a missing property");
  return { ok: true as const, plan, property };
}

export const activatePropertyAutopilot = defineTool({
  name: "activate_property_autopilot",
  title: "Activate property Autopilot",
  version: "1.0.0",
  category: "autopilot",
  executionClass: "execute",
  ...operational("execute"),
  owner: "sagolik-autopilot",
  requiredScopes: ["autopilot.execute"],
  approvalRequired: true,
  idempotency: "approval",
  providers: ["financial_data", "payments"],
  description: {
    summary:
      "Use this tool only after a user has reviewed and approved a prepared property-autopilot configuration. This tool may create real operational instructions and therefore requires EXECUTE permission and explicit approval. Do not call this tool merely to preview, analyze or prepare an automation plan.",
    whenToUse: ["When the user has reviewed a plan from prepare_property_autopilot or prepare_recurring_property_payments and wants it activated."],
    whenNotToUse: ["To preview, analyze or prepare automation.", "Without a plan_id from a prepared plan."],
    requiredContext: [
      "A plan_id from prepare_property_autopilot or prepare_recurring_property_payments.",
      "The first call returns approval_required with an approval_id and a summary for the user. After the user approves in Sagolik, call again with the same plan_id and the approval_id.",
    ],
    effect:
      "Creates active Autopilot rules. Where a payment provider is connected, registers recurring payment instructions with it; otherwise rules operate as reminders. Sagolik never moves funds itself. The approval is single-use.",
    limitations: ["In the sandbox, payment scheduling is simulated and no funds move.", "In production without a connected payment provider, scheduled payments are downgraded to reminders."],
    example: { request: "Yes, activate the plan.", arguments: { plan_id: "<plan_id>", approval_id: "<approval_id after the user approves>" } },
  },
  input: z.strictObject({ plan_id: z.uuid().describe("plan_id from a prepare_* Autopilot tool."), approval_id: approvalIdInput }),
  output: z.object({
    plan_id: z.string(),
    status: z.literal("activated"),
    property: propertyRefOutput,
    rules: z.array(
      z.object({
        rule_id: z.string(),
        kind: obligationKindEnum,
        payee: z.string(),
        action: actionEnum,
        execution_mode: z.enum(["reminder_only", "provider_scheduled", "simulated"]),
        next_run_on: z.string().nullable(),
        provider_reference: z.string().nullable(),
      }),
    ),
    funds_moved: z.literal(false),
    note: z.string(),
  }),
})({
  async describeApproval(ctx, input) {
    const loaded = await loadActivatablePlan(ctx, input.plan_id);
    if (!loaded.ok) return loaded.outcome;
    const { plan, property } = loaded;
    const scheduled = plan.items.filter((i) => i.action === "schedule_payment");
    const others = plan.items.length - scheduled.length;
    const monthly = scheduled.reduce((acc, i) => acc + monthlyEquivalentCents(i.amount_cents, i.frequency), 0);
    const largest = scheduled.reduce((acc, i) => Math.max(acc, i.amount_cents), 0);
    let fundingLabel: string | null = null;
    if (plan.funding_account_id) {
      const account = (await ctx.financial.accounts()).items.find((a) => a.id === plan.funding_account_id);
      fundingLabel = account ? `${account.name} ••${account.mask}` : "the selected funding account";
    }
    const schedulePhrase = scheduled.length
      ? `schedule ${scheduled.length} recurring payment${scheduled.length > 1 ? "s" : ""} (${scheduled.map((i) => `${OBLIGATION_LABEL[i.kind]} ${formatUsd(i.amount_cents, { precise: true })}/${i.frequency === "monthly" ? "mo" : i.frequency}`).join(", ")})${fundingLabel ? ` from ${fundingLabel}` : ""}`
      : "";
    const otherPhrase = others ? `set reminders or tracking for ${others} other obligation${others > 1 ? "s" : ""}` : "";
    return {
      action: `activate Sagolik Autopilot for ${propertyLabel(property)}: ${[schedulePhrase, otherPhrase].filter(Boolean).join(", and ")}`,
      amountCents: largest || null,
      details: {
        action: "Activate Autopilot plan",
        affected: [
          { kind: "property", reference: property.reference, label: propertyLabel(property) },
          ...(fundingLabel && plan.funding_account_id ? [{ kind: "account", reference: plan.funding_account_id, label: fundingLabel }] : []),
        ],
        amount: scheduled.length ? { amount: monthly / 100, currency: "USD", cadence: "monthly equivalent" } : null,
        provider: ctx.payments ? ctx.payments.label : "No payment provider connected — reminders only",
        expected_result: `${plan.items.length} Autopilot rule(s) become active for ${property.reference}.${scheduled.length ? ctx.payments ? " Recurring payments are scheduled with the provider." : " Payments will be reminders until a payment provider is connected." : ""}`,
        risks: [
          ...(scheduled.length ? ["Scheduled payments are initiated automatically on their due dates until you pause or disable the rule."] : []),
          "Estimated amounts and unverified payees are never paid automatically; they remain reminders.",
          "You can pause or disable any rule in Sagolik at any time.",
        ],
      },
    };
  },
  async handler(ctx, input) {
    const loaded = await loadActivatablePlan(ctx, input.plan_id);
    if (!loaded.ok) return loaded.outcome;
    const { plan, property } = loaded;
    const now = ctx.now.toISOString();
    const warnings: ToolWarning[] = [];
    const existing = await ctx.data.listAutopilotRules({ propertyId: property.id });
    const rules: AutopilotRuleRow[] = [];
    for (const item of plan.items) {
      let action = item.action;
      let mode: AutopilotRuleRow["execution_mode"] = "reminder_only";
      let providerRef: string | null = null;
      if (action === "schedule_payment") {
        if (ctx.payments && item.funding_account_id) {
          ctx.touchProvider(ctx.payments.id);
          const result = await ctx.payments.scheduleRecurring({
            organizationId: ctx.organizationId,
            environment: ctx.environment,
            propertyReference: property.reference,
            item,
            fundingAccountId: item.funding_account_id,
            idempotencyKey: `${plan.id}:${item.obligation_id}`,
          });
          mode = result.mode;
          providerRef = result.providerReference;
        } else {
          action = "remind";
          warnings.push({ code: "downgraded_to_reminder", message: `${OBLIGATION_LABEL[item.kind]}: no payment provider is connected, so this rule is a reminder.` });
        }
      }
      const due = item.next_due_date ? projectDueDates(item.next_due_date, item.frequency, ctx.today, addDays(ctx.today, 400))[0] ?? null : null;
      rules.push({
        id: ctx.newId(),
        organization_id: ctx.organizationId,
        environment: ctx.environment,
        property_id: property.id,
        plan_id: plan.id,
        obligation_id: item.obligation_id,
        action,
        status: "active",
        funding_account_id: action === "schedule_payment" ? item.funding_account_id : null,
        lead_days: item.lead_days,
        execution_mode: mode,
        provider_id: providerRef ? (ctx.payments?.id ?? null) : null,
        provider_reference: providerRef,
        next_run_on: due ? addDays(due, -item.lead_days) : null,
        last_run_at: null,
        failure_reason: null,
        created_at: now,
        updated_at: now,
      });
    }
    // Replace prior rules for the same obligations so an obligation is never automated twice.
    for (const old of existing) {
      if (old.status !== "disabled" && rules.some((r) => r.obligation_id === old.obligation_id)) {
        await ctx.data.updateAutopilotRule(old.id, { status: "disabled", updated_at: now });
      }
    }
    await ctx.data.insertAutopilotRules(rules);
    await ctx.data.updateAutopilotPlan(plan.id, { status: "activated", activated_at: now, approval_id: ctx.approval?.id ?? null, updated_at: now });

    return {
      status: "success",
      stateChanged: true,
      data: {
        plan_id: plan.id,
        status: "activated",
        property: propertyRef(property),
        rules: rules.map((r) => {
          const item = plan.items.find((i) => i.obligation_id === r.obligation_id)!;
          return { rule_id: r.id, kind: item.kind, payee: item.payee, action: r.action, execution_mode: r.execution_mode, next_run_on: r.next_run_on, provider_reference: r.provider_reference };
        }),
        funds_moved: false,
        note:
          ctx.environment === "sandbox"
            ? "Sandbox activation. Payment scheduling is simulated; no funds move."
            : "Sagolik does not hold or move funds. Scheduled payments are executed by the connected payment provider, if any.",
      },
      summary: `Activated Autopilot for ${propertyLabel(property)}: ${rules.length} rule(s) active (${rules.filter((r) => r.action === "schedule_payment").length} scheduled payment(s)).`,
      warnings,
    };
  },
});

/* ───────────────────────── get_autopilot_status ───────────────────────── */

export const getAutopilotStatus = defineTool({
  name: "get_autopilot_status",
  title: "Get Autopilot status",
  version: "1.0.0",
  category: "autopilot",
  executionClass: "read",
  ...operational("read"),
  owner: "sagolik-autopilot",
  requiredScopes: ["autopilot.read"],
  approvalRequired: false,
  idempotency: "none",
  providers: [],
  description: {
    summary: "Return a property's Autopilot state: whether it is enabled, which obligations are covered, upcoming payments, unresolved obligations, failed actions, draft plans and approvals awaiting the user.",
    whenToUse: ["When the user asks whether their property bills are handled, or after activation to confirm the result."],
    whenNotToUse: ["To change automation — use the prepare and activate tools."],
    requiredContext: ["A property_id."],
    effect: "Read-only.",
    example: { request: "Is autopilot handling Juniper Street?", arguments: { property_id: "SGK-1017" } },
  },
  input: z.strictObject({ property_id: propertyIdInput, days: z.int().min(7).max(120).default(60) }),
  output: z.object({
    property: propertyRefOutput,
    enabled: z.boolean(),
    obligations_covered: z.object({ covered: z.int(), total: z.int() }),
    upcoming_payments: z.array(z.object({ due_date: z.string(), kind: obligationKindEnum, payee: z.string(), amount: moneyOutput, action: actionEnum, execution_mode: z.string() })),
    unresolved_obligations: z.array(z.object({ obligation_id: z.string(), kind: obligationKindEnum, payee: z.string(), reason: z.string() })),
    failed_actions: z.array(z.object({ rule_id: z.string(), kind: obligationKindEnum, payee: z.string(), failure_reason: z.string() })),
    draft_plans: z.array(z.object({ plan_id: z.string(), kind: z.string(), status: z.string(), expires_at: z.string() })),
    required_approvals: z.array(z.object({ approval_id: z.string(), summary: z.string(), expires_at: z.string() })),
  }),
})({
  async handler(ctx, input) {
    const resolved = await resolveProperty(ctx, input.property_id);
    if (!resolved.ok) return resolved.outcome;
    const property = resolved.value;
    const [obligations, rules, plans, pending] = await Promise.all([
      ctx.data.listObligations({ propertyId: property.id }),
      ctx.data.listAutopilotRules({ propertyId: property.id }),
      ctx.data.listAutopilotPlans({ propertyId: property.id }),
      ctx.approvals.listPending(),
    ]);
    const live = obligations.filter((o) => o.status !== "ended");
    const byId = new Map(live.map((o) => [o.id, o]));
    const activeRules = rules.filter((r) => r.status === "active");
    const covered = live.filter((o) => activeRules.some((r) => r.obligation_id === o.id));
    const to = addDays(ctx.today, input.days);
    const upcoming = activeRules
      .filter((r) => r.action !== "track")
      .flatMap((r) => {
        const o = byId.get(r.obligation_id);
        if (!o) return [];
        return projectDueDates(o.next_due_date, o.frequency, ctx.today, to).map((due) => ({
          due_date: due,
          kind: o.kind,
          payee: o.payee,
          amount: money(o.amount_cents),
          action: r.action,
          execution_mode: r.execution_mode,
        }));
      })
      .sort((a, b) => a.due_date.localeCompare(b.due_date));
    const failed = rules
      .filter((r) => r.status === "failed")
      .map((r) => {
        const o = byId.get(r.obligation_id);
        return { rule_id: r.id, kind: o?.kind ?? ("other" as const), payee: o?.payee ?? "Unknown", failure_reason: r.failure_reason ?? "Automation failed." };
      });
    const unresolved = live
      .filter((o) => !covered.includes(o))
      .map((o) => ({
        obligation_id: o.id,
        kind: o.kind,
        payee: o.payee,
        reason: rules.some((r) => r.obligation_id === o.id && r.status === "failed") ? "Automation failed; see failed_actions." : "Not covered by Autopilot.",
      }));
    const drafts = plans.filter((p) => p.status === "draft" && p.expires_at > ctx.now.toISOString());
    const draftIds = new Set(drafts.map((p) => p.id));
    const approvals = pending.filter((a) => typeof a.arguments.plan_id === "string" && (draftIds.has(a.arguments.plan_id) || a.details.affected.some((x) => x.reference === property.reference)));

    return {
      status: "success",
      data: {
        property: propertyRef(property),
        enabled: activeRules.length > 0,
        obligations_covered: { covered: covered.length, total: live.length },
        upcoming_payments: upcoming,
        unresolved_obligations: unresolved,
        failed_actions: failed,
        draft_plans: drafts.map((p) => ({ plan_id: p.id, kind: p.kind, status: p.status, expires_at: p.expires_at })),
        required_approvals: approvals.map((a) => ({ approval_id: a.id, summary: a.summary, expires_at: a.expires_at })),
      },
      summary: activeRules.length
        ? `Autopilot is enabled for ${property.reference}: ${covered.length}/${live.length} obligations covered, ${upcoming.length} action(s) in the next ${input.days} days, ${failed.length} failed, ${approvals.length} awaiting approval.`
        : `Autopilot is not enabled for ${property.reference}.${drafts.length ? ` ${drafts.length} draft plan(s) await activation.` : ""}`,
      warnings: failed.length ? [{ code: "automation_failures", message: `${failed.length} Autopilot rule(s) failed and need attention.` }] : [],
    };
  },
});
