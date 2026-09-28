import { z } from "zod";
import type {
  ClosingChecklistItem,
  ClosingStage,
  DocumentCategory,
  PropertyRow,
  Severity,
  TransactionRow,
} from "@/domain/entities";
import { CLOSING_STAGES } from "@/domain/entities";
import { daysBetween } from "@/domain/dates";
import { STAGE_META } from "@/domain/closing/stages";
import { formatUsd } from "@/domain/money";
import { hasScope } from "./access";
import { accountRef, money, propertyRef, transactionRef } from "./format";
import { operational } from "./meta";
import { resolveTransaction } from "./resolve";
import {
  accountRefOutput,
  closingStageEnum,
  idempotencyKeyInput,
  moneyOutput,
  partyEnum,
  propertyIdInput,
  propertyRefOutput,
  severityEnum,
  transactionIdInput,
  transactionRefOutput,
} from "./schemas";
import { assessFundsReadiness, loanForTransaction } from "./shared";
import { defineTool, type ToolContext } from "./types";

const txInput = { transaction_id: transactionIdInput.optional(), property_id: propertyIdInput.optional() };
const SEVERITY_RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

/* ───────────────────────── get_closing_status ───────────────────────── */

export const getClosingStatus = defineTool({
  name: "get_closing_status",
  title: "Get closing status",
  version: "1.0.0",
  category: "closing",
  executionClass: "read",
  ...operational("read"),
  owner: "sagolik-closing",
  requiredScopes: ["closing.read"],
  approvalRequired: false,
  idempotency: "none",
  providers: [],
  description: {
    summary:
      "Return the full closing lifecycle for a purchase — offer, contract, financing, inspection, title, insurance, escrow, funds, signing, recording and ownership — with status, owner and due date for each stage.",
    whenToUse: [
      "When the user asks where a purchase stands or what remains before closing.",
      "As the first call in any closing conversation, then identify_closing_blockers for detail.",
    ],
    whenNotToUse: ["For a property that is already owned — use get_ownership_profile.", "To change any milestone; this tool cannot."],
    requiredContext: ["A transaction_id, or a property_id with exactly one active purchase."],
    effect: "Read-only. No database write occurs.",
    example: { request: "Use Sagolik to tell me what remains before this property can close.", arguments: { property_id: "SGK-1042" } },
  },
  input: z.strictObject(txInput),
  output: z.object({
    property: propertyRefOutput,
    transaction: transactionRefOutput,
    closing_date: z.string().nullable(),
    days_to_closing: z.int().nullable(),
    overall_status: z.enum(["on_track", "at_risk", "blocked", "closed"]),
    progress: z.object({ completed: z.int(), total: z.int(), percent: z.int() }),
    current_stage: closingStageEnum,
    stages: z.array(
      z.object({
        stage: closingStageEnum,
        label: z.string(),
        status: z.string(),
        owner: z.string(),
        due_date: z.string().nullable(),
        completed_at: z.string().nullable(),
        overdue: z.boolean(),
        notes: z.string().nullable(),
      }),
    ),
    open_blockers: z.object({ total: z.int(), critical: z.int(), high: z.int(), medium: z.int(), low: z.int() }),
    next_milestones: z.array(z.object({ stage: closingStageEnum, label: z.string(), due_date: z.string().nullable(), owner: z.string() })),
  }),
})({
  async handler(ctx, input) {
    const resolved = await resolveTransaction(ctx, input, { includeClosed: true });
    if (!resolved.ok) return resolved.outcome;
    const { transaction: tx, property } = resolved.value;
    const [milestones, blockers] = await Promise.all([ctx.data.listMilestones(tx.id), ctx.data.listBlockers(tx.id)]);
    const ordered = [...milestones].sort((a, b) => a.position - b.position);
    const open = blockers.filter((b) => b.status === "open");
    const count = (s: Severity) => open.filter((b) => b.severity === s).length;
    const stages = ordered.map((m) => ({
      stage: m.stage,
      label: STAGE_META[m.stage].label,
      status: m.status,
      owner: m.owner,
      due_date: m.due_date,
      completed_at: m.completed_at,
      overdue: m.status !== "complete" && !!m.due_date && m.due_date < ctx.today,
      notes: m.notes,
    }));
    const completed = stages.filter((s) => s.status === "complete").length;
    const overallStatus =
      tx.status === "closed"
        ? ("closed" as const)
        : stages.some((s) => s.status === "blocked") || count("critical") > 0
          ? ("blocked" as const)
          : count("high") > 0 || stages.some((s) => s.overdue)
            ? ("at_risk" as const)
            : ("on_track" as const);
    const next = stages
      .filter((s) => s.status !== "complete")
      .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"))
      .slice(0, 3)
      .map((s) => ({ stage: s.stage, label: s.label, due_date: s.due_date, owner: s.owner }));
    const days = tx.closing_date ? daysBetween(ctx.today, tx.closing_date) : null;
    const blockedStages = stages.filter((s) => s.status === "blocked").map((s) => s.label);

    return {
      status: "success",
      data: {
        property: propertyRef(property),
        transaction: transactionRef(tx),
        closing_date: tx.closing_date,
        days_to_closing: days,
        overall_status: overallStatus,
        progress: { completed, total: stages.length, percent: stages.length ? Math.round((completed / stages.length) * 100) : 0 },
        current_stage: tx.current_stage,
        stages,
        open_blockers: { total: open.length, critical: count("critical"), high: count("high"), medium: count("medium"), low: count("low") },
        next_milestones: next,
      },
      summary:
        tx.status === "closed"
          ? `Transaction ${tx.reference} closed on ${tx.closing_date}.`
          : `${property.reference} closes ${tx.closing_date ?? "on an unscheduled date"}${days !== null ? ` (${days} days)` : ""}. ${completed}/${stages.length} stages complete; status ${overallStatus.replace("_", " ")}. ${open.length} open blocker(s)${blockedStages.length ? `; blocked: ${blockedStages.join(", ")}` : ""}.`,
    };
  },
});

/* ───────────────────────── identify_closing_blockers ───────────────────────── */

const DOCUMENT_STAGE: Partial<Record<DocumentCategory, ClosingStage>> = {
  purchase_agreement: "contract",
  disclosure: "contract",
  financing: "financing",
  inspection: "inspection",
  title: "title",
  hoa: "title",
  survey: "title",
  insurance: "insurance",
  escrow: "escrow",
  identity: "signing",
  closing: "signing",
};

interface Blocker {
  id: string | null;
  title: string;
  description: string;
  stage: ClosingStage;
  severity: Severity;
  owner: string;
  deadline: string | null;
  days_until_deadline: number | null;
  dependency: string | null;
  recommended_next_action: string;
  source: "record" | "derived";
}

function severityForDeadline(days: number | null): Severity {
  if (days === null) return "medium";
  if (days < 0) return "critical";
  if (days <= 7) return "high";
  if (days <= 14) return "medium";
  return "low";
}

/** Record blockers plus blockers derived from documents, funds, rate lock and overdue milestones. */
export async function collectBlockers(ctx: ToolContext, tx: TransactionRow, property: PropertyRow, includeDerived: boolean) {
  const until = (date: string | null) => (date ? daysBetween(ctx.today, date) : null);
  const records = (await ctx.data.listBlockers(tx.id)).filter((b) => b.status === "open");
  const blockers: Blocker[] = records.map((b) => ({
    id: b.id,
    title: b.title,
    description: b.description,
    stage: b.stage,
    severity: b.severity,
    owner: b.owner,
    deadline: b.deadline,
    days_until_deadline: until(b.deadline),
    dependency: b.dependency,
    recommended_next_action: b.recommended_action,
    source: "record",
  }));
  const unevaluated: string[] = [];

  if (includeDerived && tx.status === "active") {
    const coveredStages = new Set(records.map((b) => b.stage));
    if (hasScope(ctx, "documents.read")) {
      const docs = await ctx.data.listDocuments({ transactionId: tx.id });
      for (const d of docs) {
        if (!d.required_for_closing || d.status === "accepted" || d.status === "uploaded") continue;
        const stage = d.title.toLowerCase().includes("wire") ? "funds" : (DOCUMENT_STAGE[d.category] ?? "signing");
        if (coveredStages.has(stage)) continue;
        const days = until(d.required_by);
        blockers.push({
          id: null,
          title: `${d.title} — ${d.status.replaceAll("_", " ")}`,
          description: `A document required for closing is ${d.status.replaceAll("_", " ")}.`,
          stage,
          severity: severityForDeadline(days),
          owner: d.provided_by,
          deadline: d.required_by,
          days_until_deadline: days,
          dependency: `${STAGE_META[stage].label} stage`,
          recommended_next_action:
            stage === "funds"
              ? "Obtain wire instructions from the title company and verify them by phone using a known number before sending funds."
              : `Request the ${d.title.toLowerCase()} from the ${d.provided_by.replace("_", " ")}.`,
          source: "derived",
        });
      }
    } else unevaluated.push("documents (requires documents.read)");

    if (hasScope(ctx, "finance.read")) {
      const funds = await assessFundsReadiness(ctx, tx, property);
      if (funds.status !== "ready") {
        const fundsDeadline = (await ctx.data.listMilestones(tx.id)).find((m) => m.stage === "funds")?.due_date ?? null;
        const days = until(fundsDeadline);
        blockers.push({
          id: null,
          title:
            funds.status === "ready_pending_transfers"
              ? "Closing funds depend on a pending transfer"
              : funds.status === "shortfall"
                ? "Verified funds are below the estimated cash to close"
                : "Funds readiness cannot be assessed",
          description:
            funds.status === "insufficient_data"
              ? "No liquid connected accounts are available to assess readiness."
              : `Estimated ${formatUsd(funds.requiredCents)} required; ${formatUsd(funds.verifiedCents)} verified in liquid accounts; ${formatUsd(funds.pendingIncomingCents)} pending.`,
          stage: "funds",
          severity: funds.status === "shortfall" ? "high" : "medium",
          owner: "buyer",
          deadline: fundsDeadline,
          days_until_deadline: days,
          dependency: "Closing disclosure (final amount)",
          recommended_next_action:
            funds.status === "ready_pending_transfers"
              ? "Confirm the pending transfer settles before the funds deadline; call verify_funds_readiness again afterwards."
              : "Review verify_funds_readiness and arrange additional liquid funds.",
          source: "derived",
        });
      }
    } else unevaluated.push("funds readiness (requires finance.read)");

    const loan = await loanForTransaction(ctx, tx);
    if (loan?.rate_lock_expires_on && tx.closing_date && loan.rate_lock_expires_on < tx.closing_date) {
      blockers.push({
        id: null,
        title: "Rate lock expires before closing",
        description: `The rate lock expires on ${loan.rate_lock_expires_on}, before the ${tx.closing_date} closing.`,
        stage: "financing",
        severity: "high",
        owner: "lender",
        deadline: loan.rate_lock_expires_on,
        days_until_deadline: until(loan.rate_lock_expires_on),
        dependency: "Loan pricing",
        recommended_next_action: "Ask the lender about a lock extension and its cost.",
        source: "derived",
      });
    }

    for (const m of await ctx.data.listMilestones(tx.id)) {
      if (m.status === "complete" || !m.due_date || m.due_date >= ctx.today || coveredStages.has(m.stage)) continue;
      blockers.push({
        id: null,
        title: `${STAGE_META[m.stage].label} milestone overdue`,
        description: `${STAGE_META[m.stage].description} Due ${m.due_date}.`,
        stage: m.stage,
        severity: "high",
        owner: m.owner,
        deadline: m.due_date,
        days_until_deadline: until(m.due_date),
        dependency: null,
        recommended_next_action: `Contact the ${m.owner.replace("_", " ")} responsible for ${STAGE_META[m.stage].label.toLowerCase()}.`,
        source: "derived",
      });
    }
  }

  blockers.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999"));
  return { blockers, unevaluated };
}

const blockerOutput = z.object({
  id: z.string().nullable(),
  title: z.string(),
  description: z.string(),
  stage: closingStageEnum,
  severity: severityEnum,
  owner: z.string(),
  deadline: z.string().nullable(),
  days_until_deadline: z.int().nullable(),
  dependency: z.string().nullable(),
  recommended_next_action: z.string(),
  source: z.enum(["record", "derived"]),
});

export const identifyClosingBlockers = defineTool({
  name: "identify_closing_blockers",
  title: "Identify closing blockers",
  version: "1.0.0",
  category: "closing",
  executionClass: "read",
  ...operational("read"),
  owner: "sagolik-closing",
  requiredScopes: ["closing.read"],
  approvalRequired: false,
  idempotency: "none",
  providers: ["financial_data"],
  description: {
    summary:
      "Analyze a purchase and list every unresolved item preventing closing, with severity, owner, deadline, dependency and the recommended next action.",
    whenToUse: ["When the user asks what is holding up closing, or what they must do next.", "After get_closing_status shows open blockers."],
    whenNotToUse: ["To resolve a blocker — prepare actions with the prepare_* tools instead.", "For owned properties."],
    requiredContext: [
      "A transaction_id, or a property_id with exactly one active purchase.",
      "documents.read and finance.read broaden the analysis to documents and funds; without them those areas are reported as unevaluated.",
    ],
    effect: "Read-only analysis. No records change.",
    example: { request: "What's blocking my closing?", arguments: { property_id: "SGK-1042" } },
  },
  input: z.strictObject({
    ...txInput,
    include_derived: z.boolean().default(true).describe("Also derive blockers from documents, funds, rate lock and overdue milestones."),
  }),
  output: z.object({
    property: propertyRefOutput,
    transaction: transactionRefOutput,
    closing_date: z.string().nullable(),
    days_to_closing: z.int().nullable(),
    blockers: z.array(blockerOutput),
    summary: z.object({ total: z.int(), critical: z.int(), high: z.int(), medium: z.int(), low: z.int() }),
    unevaluated: z.array(z.string()),
  }),
})({
  async handler(ctx, input) {
    const resolved = await resolveTransaction(ctx, input);
    if (!resolved.ok) return resolved.outcome;
    const { transaction: tx, property } = resolved.value;
    const { blockers, unevaluated } = await collectBlockers(ctx, tx, property, input.include_derived);
    const count = (s: Severity) => blockers.filter((b) => b.severity === s).length;
    return {
      status: unevaluated.length ? "partial" : "success",
      data: {
        property: propertyRef(property),
        transaction: transactionRef(tx),
        closing_date: tx.closing_date,
        days_to_closing: tx.closing_date ? daysBetween(ctx.today, tx.closing_date) : null,
        blockers,
        summary: { total: blockers.length, critical: count("critical"), high: count("high"), medium: count("medium"), low: count("low") },
        unevaluated,
      },
      summary: blockers.length
        ? `${blockers.length} blocker(s) before closing ${property.reference}: ${blockers
            .slice(0, 4)
            .map((b) => `${b.title} (${b.severity}, ${b.owner.replace("_", " ")}${b.deadline ? `, by ${b.deadline}` : ""})`)
            .join("; ")}${blockers.length > 4 ? "; …" : ""}.`
        : `No open blockers for ${property.reference}.`,
      warnings: unevaluated.length ? [{ code: "partial_analysis", message: `Not evaluated: ${unevaluated.join(", ")}.` }] : [],
      events: blockers.some((b) => b.severity === "critical")
        ? [{ type: "closing.blocker_detected", payload: { transaction: tx.reference, property: property.reference, critical: count("critical") } }]
        : [],
    };
  },
});

/* ───────────────────────── prepare_closing_checklist ───────────────────────── */

export const prepareClosingChecklist = defineTool({
  name: "prepare_closing_checklist",
  title: "Prepare closing checklist",
  version: "1.0.0",
  category: "closing",
  executionClass: "prepare",
  ...operational("prepare"),
  owner: "sagolik-closing",
  requiredScopes: ["closing.read", "closing.prepare"],
  approvalRequired: false,
  idempotency: "key",
  providers: [],
  description: {
    summary: "Create a transaction-specific closing checklist from milestones, required documents and open blockers, saved as a draft for human review.",
    whenToUse: ["When the user wants an organized list of everything to do before closing."],
    whenNotToUse: ["To simply read status — use get_closing_status.", "To send requests to other parties; checklists are internal drafts."],
    requiredContext: ["A transaction_id, or a property_id with exactly one active purchase."],
    effect: "Creates a draft checklist in Sagolik and supersedes previous drafts for the same transaction. Nothing is sent or executed.",
    example: { request: "Make me a closing checklist for Mercer.", arguments: { property_id: "SGK-1042" } },
  },
  input: z.strictObject({ ...txInput, idempotency_key: idempotencyKeyInput }),
  output: z.object({
    checklist_id: z.string(),
    status: z.literal("draft"),
    property: propertyRefOutput,
    transaction: transactionRefOutput,
    items: z.array(
      z.object({
        key: z.string(),
        stage: closingStageEnum,
        title: z.string(),
        owner: partyEnum,
        due_date: z.string().nullable(),
        status: z.enum(["done", "open", "blocked"]),
        source: z.enum(["milestone", "document", "blocker", "funds"]),
      }),
    ),
    counts: z.object({ total: z.int(), open: z.int(), blocked: z.int(), done: z.int() }),
    note: z.string(),
  }),
})({
  async handler(ctx, input) {
    const resolved = await resolveTransaction(ctx, input);
    if (!resolved.ok) return resolved.outcome;
    const { transaction: tx, property } = resolved.value;
    const [milestones, blockers] = await Promise.all([ctx.data.listMilestones(tx.id), ctx.data.listBlockers(tx.id)]);
    const docs = hasScope(ctx, "documents.read") ? await ctx.data.listDocuments({ transactionId: tx.id }) : [];

    const items: ClosingChecklistItem[] = [];
    for (const m of [...milestones].sort((a, b) => a.position - b.position)) {
      items.push({
        key: `milestone:${m.stage}`,
        stage: m.stage,
        title: STAGE_META[m.stage].description,
        owner: m.owner,
        due_date: m.due_date,
        status: m.status === "complete" ? "done" : m.status === "blocked" ? "blocked" : "open",
        source: "milestone",
      });
    }
    for (const b of blockers.filter((x) => x.status === "open")) {
      items.push({ key: `blocker:${b.id}`, stage: b.stage, title: b.recommended_action, owner: b.owner, due_date: b.deadline, status: "open", source: "blocker" });
    }
    for (const d of docs.filter((x) => x.required_for_closing && x.status !== "accepted")) {
      items.push({
        key: `document:${d.id}`,
        stage: DOCUMENT_STAGE[d.category] ?? "signing",
        title: `${d.title}: ${d.status.replaceAll("_", " ")}`,
        owner: d.provided_by,
        due_date: d.required_by,
        status: "open",
        source: "document",
      });
    }
    items.push({
      key: "funds:wire-verification",
      stage: "funds",
      title: "Verify wire instructions by phone with the title company before sending closing funds.",
      owner: "buyer",
      due_date: milestones.find((m) => m.stage === "funds")?.due_date ?? null,
      status: "open",
      source: "funds",
    });
    items.sort((a, b) => CLOSING_STAGES.indexOf(a.stage) - CLOSING_STAGES.indexOf(b.stage) || (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));

    const id = ctx.newId();
    const now = ctx.now.toISOString();
    await ctx.data.insertChecklist({
      id,
      organization_id: ctx.organizationId,
      environment: ctx.environment,
      transaction_id: tx.id,
      status: "draft",
      items,
      prepared_by_connection_id: ctx.client.connectionId,
      created_at: now,
      updated_at: now,
    });
    await ctx.data.supersedeChecklists(tx.id, id);
    const counts = {
      total: items.length,
      open: items.filter((i) => i.status === "open").length,
      blocked: items.filter((i) => i.status === "blocked").length,
      done: items.filter((i) => i.status === "done").length,
    };
    return {
      status: "success",
      stateChanged: true,
      data: {
        checklist_id: id,
        status: "draft",
        property: propertyRef(property),
        transaction: transactionRef(tx),
        items,
        counts,
        note: "Draft only. Nothing has been sent to any party or executed.",
      },
      summary: `Prepared a draft closing checklist for ${property.reference} with ${counts.total} items (${counts.open} open, ${counts.blocked} blocked, ${counts.done} done).`,
    };
  },
});

/* ───────────────────────── verify_funds_readiness ───────────────────────── */

export const verifyFundsReadiness = defineTool({
  name: "verify_funds_readiness",
  title: "Verify funds readiness",
  version: "1.0.0",
  category: "closing",
  executionClass: "read",
  ...operational("read"),
  owner: "sagolik-closing",
  requiredScopes: ["closing.read", "finance.read"],
  approvalRequired: false,
  idempotency: "none",
  providers: ["financial_data"],
  description: {
    summary:
      "Assess, from Sagolik-authorized account data, whether the funds required for closing appear ready: required amount, verified liquid funds, pending transfers and unresolved issues.",
    whenToUse: ["When the user asks whether they have enough cash for closing, or whether their transfer has arrived."],
    whenNotToUse: [
      "As proof of funds for a lender or title company — only the receiving institution can confirm funds.",
      "To move money; this tool cannot initiate transfers.",
    ],
    requiredContext: ["A transaction_id, or a property_id with exactly one active purchase."],
    effect: "Read-only. Returns aggregated conclusions; account-level balances only when include_account_breakdown is true.",
    limitations: [
      "Indicative only. Never a legal or final verification of funds.",
      "The required amount is an estimate until the closing disclosure is issued.",
    ],
    example: { request: "Is there enough cash available for closing?", arguments: { property_id: "SGK-1042" } },
  },
  input: z.strictObject({
    ...txInput,
    include_account_breakdown: z.boolean().default(false).describe("Include per-account balances. Leave false unless the user needs account-level detail."),
  }),
  output: z.object({
    property: propertyRefOutput,
    transaction: transactionRefOutput,
    status: z.enum(["ready", "ready_pending_transfers", "shortfall", "insufficient_data"]),
    confidence: z.literal("indicative"),
    required_amount: moneyOutput,
    required_basis: z.enum(["estimate", "closing_disclosure"]),
    verified_available: moneyOutput,
    pending_incoming: moneyOutput,
    projected_available: moneyOutput,
    surplus_or_shortfall: moneyOutput,
    days_to_closing: z.int().nullable(),
    pending_transfers: z.array(z.object({ amount: moneyOutput, description: z.string(), initiated_on: z.string() })),
    accounts: z.array(accountRefOutput.extend({ available: moneyOutput })).nullable(),
    unresolved_issues: z.array(z.string()),
    disclaimer: z.string(),
  }),
})({
  async handler(ctx, input) {
    const resolved = await resolveTransaction(ctx, input);
    if (!resolved.ok) return resolved.outcome;
    const { transaction: tx, property } = resolved.value;
    const funds = await assessFundsReadiness(ctx, tx, property);
    const docs = hasScope(ctx, "documents.read") ? await ctx.data.listDocuments({ transactionId: tx.id }) : [];
    const cd = docs.find((d) => d.category === "closing" && d.title.toLowerCase().includes("closing disclosure"));
    const wire = docs.find((d) => d.title.toLowerCase().includes("wire"));
    const issues = [...funds.issues];
    if (!cd || cd.status !== "accepted") issues.push("The closing disclosure has not been issued; the required amount is an estimate.");
    if (wire && wire.status !== "accepted") issues.push("Wire instructions have not been received and verified.");
    if (funds.pendingTransfers.length) issues.push(`${funds.pendingTransfers.length} incoming transfer(s) are pending and not yet available.`);
    const projected = funds.verifiedCents + funds.pendingIncomingCents;

    const labels = {
      ready: "appear ready",
      ready_pending_transfers: "appear sufficient once pending transfers settle",
      shortfall: "appear insufficient",
      insufficient_data: "cannot be assessed",
    } as const;

    return {
      status: "success",
      data: {
        property: propertyRef(property),
        transaction: transactionRef(tx),
        status: funds.status,
        confidence: "indicative",
        required_amount: money(funds.requiredCents),
        required_basis: cd?.status === "accepted" ? "closing_disclosure" : "estimate",
        verified_available: money(funds.verifiedCents),
        pending_incoming: money(funds.pendingIncomingCents),
        projected_available: money(projected),
        surplus_or_shortfall: money(projected - funds.requiredCents),
        days_to_closing: funds.daysToClosing,
        pending_transfers: funds.pendingTransfers.map((t) => ({ amount: money(t.amount_cents), description: t.description, initiated_on: t.posted_on })),
        accounts: input.include_account_breakdown
          ? funds.liquidAccounts.map((a) => ({ ...accountRef(a), available: money(a.available_balance_cents ?? a.current_balance_cents) }))
          : null,
        unresolved_issues: issues,
        disclaimer:
          "Indicative assessment from connected-account data. It is not a verification of funds; only the settlement agent or receiving institution can confirm funds for closing.",
      },
      summary: `Funds ${labels[funds.status]}: ${formatUsd(funds.requiredCents)} estimated required, ${formatUsd(funds.verifiedCents)} verified in liquid accounts, ${formatUsd(funds.pendingIncomingCents)} pending.`,
      warnings: [{ code: "indicative_only", message: "Not a final verification of funds." }],
    };
  },
});
