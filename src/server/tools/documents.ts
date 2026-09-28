import { z } from "zod";
import type { DocumentRow, DocumentStatus, Party, PropertyRow, TransactionRow } from "@/domain/entities";
import { DOCUMENT_STATUSES } from "@/domain/entities";
import { addDays, daysBetween } from "@/domain/dates";
import { PARTY_LABEL } from "@/domain/closing/stages";
import { propertyLabel, propertyRef, transactionRef } from "./format";
import { operational } from "./meta";
import { resolveProperty, resolveTransaction } from "./resolve";
import {
  approvalIdInput,
  documentCategoryEnum,
  documentStatusEnum,
  idempotencyKeyInput,
  partyEnum,
  propertyIdInput,
  propertyRefOutput,
  transactionIdInput,
  transactionRefOutput,
} from "./schemas";
import { loanForTransaction } from "./shared";
import { defineTool, type ToolContext } from "./types";

const OUTSTANDING: DocumentStatus[] = ["missing", "expired", "rejected", "signature_required", "verification_required"];

const ACTION: Record<DocumentStatus, string> = {
  uploaded: "Awaiting review by the responsible party.",
  missing: "Obtain and upload the document.",
  expired: "Provide a current replacement.",
  signature_required: "Collect the required signature.",
  verification_required: "Awaiting verification of the uploaded document.",
  accepted: "No action required.",
  rejected: "Review the rejection reason and provide a corrected document.",
};

const documentOutput = z.object({
  document_id: z.string(),
  title: z.string(),
  category: documentCategoryEnum,
  status: documentStatusEnum,
  required_for_closing: z.boolean(),
  required_by: z.string().nullable(),
  provided_by: z.string(),
  uploaded_at: z.string().nullable(),
  expires_on: z.string().nullable(),
});

const docView = (d: DocumentRow) => ({
  document_id: d.id,
  title: d.title,
  category: d.category,
  status: d.status,
  required_for_closing: d.required_for_closing,
  required_by: d.required_by,
  provided_by: d.provided_by,
  uploaded_at: d.uploaded_at,
  expires_on: d.expires_on,
});

/** Resolve the document scope: an explicit transaction, or all documents of a property. */
async function resolveDocumentScope(ctx: ToolContext, input: { transaction_id?: string; property_id?: string }) {
  if (input.transaction_id || !input.property_id) {
    const resolved = await resolveTransaction(ctx, input, { includeClosed: true });
    if (!resolved.ok) return resolved;
    const docs = await ctx.data.listDocuments({ transactionId: resolved.value.transaction.id });
    return { ok: true as const, value: { property: resolved.value.property, transaction: resolved.value.transaction as TransactionRow | null, docs } };
  }
  const resolved = await resolveProperty(ctx, input.property_id);
  if (!resolved.ok) return resolved;
  const txs = await ctx.data.listTransactions({ propertyId: resolved.value.id, status: "active" });
  const transaction = txs.length === 1 ? txs[0]! : null;
  const docs = await ctx.data.listDocuments(transaction ? { transactionId: transaction.id } : { propertyId: resolved.value.id });
  return { ok: true as const, value: { property: resolved.value, transaction, docs } };
}

/* ───────────────────────── list_transaction_documents ───────────────────────── */

export const listTransactionDocuments = defineTool({
  name: "list_transaction_documents",
  title: "List transaction documents",
  version: "1.0.0",
  category: "documents",
  executionClass: "read",
  ...operational("read"),
  owner: "sagolik-documents",
  requiredScopes: ["documents.read"],
  approvalRequired: false,
  idempotency: "none",
  providers: [],
  description: {
    summary: "Return the document inventory for a transaction (or an owned property), grouped by category with each document's status.",
    whenToUse: ["When the user asks which documents exist or where a particular document stands."],
    whenNotToUse: [
      "For only what is still outstanding — use retrieve_required_documents.",
      "To read document contents; contents are never exposed to agents.",
    ],
    requiredContext: ["A transaction_id or property_id. Optional category or status filters."],
    effect: "Read-only. Returns metadata only.",
    example: { request: "What documents do we have for Mercer?", arguments: { property_id: "SGK-1042" } },
  },
  input: z.strictObject({
    transaction_id: transactionIdInput.optional(),
    property_id: propertyIdInput.optional(),
    category: documentCategoryEnum.optional(),
    status: documentStatusEnum.optional(),
  }),
  output: z.object({
    property: propertyRefOutput,
    transaction: transactionRefOutput.nullable(),
    total: z.int(),
    categories: z.array(z.object({ category: documentCategoryEnum, documents: z.array(documentOutput) })),
  }),
})({
  async handler(ctx, input) {
    const resolved = await resolveDocumentScope(ctx, input);
    if (!resolved.ok) return resolved.outcome;
    const { property, transaction, docs } = resolved.value;
    const filtered = docs.filter((d) => (!input.category || d.category === input.category) && (!input.status || d.status === input.status));
    const categories = [...new Set(filtered.map((d) => d.category))].map((category) => ({
      category,
      documents: filtered.filter((d) => d.category === category).map(docView),
    }));
    return {
      status: "success",
      data: { property: propertyRef(property), transaction: transaction ? transactionRef(transaction) : null, total: filtered.length, categories },
      summary: `${filtered.length} document(s) across ${categories.length} categories for ${property.reference}.`,
    };
  },
});

/* ───────────────────────── get_document_status ───────────────────────── */

export const getDocumentStatus = defineTool({
  name: "get_document_status",
  title: "Get document status",
  version: "1.0.0",
  category: "documents",
  executionClass: "read",
  ...operational("read"),
  owner: "sagolik-documents",
  requiredScopes: ["documents.read"],
  approvalRequired: false,
  idempotency: "none",
  providers: [],
  description: {
    summary: "Summarize document statuses — uploaded, missing, expired, signature required, verification required, accepted, rejected — and list the documents that need action.",
    whenToUse: ["When the user asks whether paperwork is complete, or about one specific document."],
    whenNotToUse: ["For the full inventory — use list_transaction_documents."],
    requiredContext: ["A transaction_id or property_id. Optionally a document_id from list_transaction_documents."],
    effect: "Read-only.",
    example: { request: "Is all our closing paperwork in?", arguments: { property_id: "SGK-1042" } },
  },
  input: z.strictObject({
    transaction_id: transactionIdInput.optional(),
    property_id: propertyIdInput.optional(),
    document_id: z.uuid().optional().describe("A document_id returned by list_transaction_documents."),
  }),
  output: z.object({
    property: propertyRefOutput,
    transaction: transactionRefOutput.nullable(),
    counts: z.object(Object.fromEntries(DOCUMENT_STATUSES.map((s) => [s, z.int()])) as Record<DocumentStatus, z.ZodInt>),
    complete_for_closing: z.boolean(),
    action_required: z.array(z.object({ document_id: z.string(), title: z.string(), status: documentStatusEnum, required_by: z.string().nullable(), responsible_party: z.string(), action: z.string() })),
    document: documentOutput.extend({ action: z.string() }).nullable(),
  }),
})({
  async handler(ctx, input) {
    const resolved = await resolveDocumentScope(ctx, input);
    if (!resolved.ok) return resolved.outcome;
    const { property, transaction, docs } = resolved.value;
    let document = null;
    if (input.document_id) {
      const d = docs.find((x) => x.id === input.document_id);
      if (!d) {
        return {
          status: "needs_clarification",
          field: "document_id",
          message: `Document ${input.document_id} does not belong to ${property.reference}. Use list_transaction_documents to obtain valid document_id values.`,
        };
      }
      document = { ...docView(d), action: ACTION[d.status] };
    }
    const counts = Object.fromEntries(DOCUMENT_STATUSES.map((s) => [s, docs.filter((d) => d.status === s).length])) as Record<DocumentStatus, number>;
    const action = docs
      .filter((d) => OUTSTANDING.includes(d.status) && (d.required_for_closing || d.status === "rejected"))
      .sort((a, b) => (a.required_by ?? "9999").localeCompare(b.required_by ?? "9999"))
      .map((d) => ({ document_id: d.id, title: d.title, status: d.status, required_by: d.required_by, responsible_party: d.provided_by, action: ACTION[d.status] }));
    const complete = docs.filter((d) => d.required_for_closing).every((d) => d.status === "accepted");
    return {
      status: "success",
      data: { property: propertyRef(property), transaction: transaction ? transactionRef(transaction) : null, counts, complete_for_closing: complete, action_required: action, document },
      summary: document
        ? `${document.title}: ${document.status.replaceAll("_", " ")}. ${document.action}`
        : `${counts.accepted} accepted, ${action.length} need action (${counts.missing} missing, ${counts.signature_required} awaiting signature, ${counts.verification_required} awaiting verification).`,
    };
  },
});

/* ───────────────────────── retrieve_required_documents ───────────────────────── */

export const retrieveRequiredDocuments = defineTool({
  name: "retrieve_required_documents",
  title: "Retrieve required documents",
  version: "1.0.0",
  category: "documents",
  executionClass: "read",
  ...operational("read"),
  owner: "sagolik-documents",
  requiredScopes: ["documents.read"],
  approvalRequired: false,
  idempotency: "none",
  providers: [],
  description: {
    summary: "List documents required for closing that are not yet accepted, grouped by the party responsible, with due dates and actions.",
    whenToUse: ["When the user asks what paperwork is still needed and who must provide it."],
    whenNotToUse: ["To request a document from a party — use prepare_document_request."],
    requiredContext: ["A transaction_id, or a property_id with exactly one active purchase."],
    effect: "Read-only.",
    example: { request: "What documents are still needed and from whom?", arguments: { property_id: "SGK-1042" } },
  },
  input: z.strictObject({ transaction_id: transactionIdInput.optional(), property_id: propertyIdInput.optional() }),
  output: z.object({
    property: propertyRefOutput,
    transaction: transactionRefOutput,
    total_required: z.int(),
    total_outstanding: z.int(),
    outstanding: z.array(
      z.object({
        document_id: z.string(),
        title: z.string(),
        category: documentCategoryEnum,
        status: documentStatusEnum,
        required_by: z.string().nullable(),
        days_until_due: z.int().nullable(),
        responsible_party: z.string(),
        action: z.string(),
      }),
    ),
    by_party: z.array(z.object({ party: z.string(), label: z.string(), count: z.int() })),
  }),
})({
  async handler(ctx, input) {
    const resolved = await resolveTransaction(ctx, input);
    if (!resolved.ok) return resolved.outcome;
    const { transaction: tx, property } = resolved.value;
    const docs = (await ctx.data.listDocuments({ transactionId: tx.id })).filter((d) => d.required_for_closing);
    const outstanding = docs
      .filter((d) => d.status !== "accepted")
      .sort((a, b) => (a.required_by ?? "9999").localeCompare(b.required_by ?? "9999"))
      .map((d) => ({
        document_id: d.id,
        title: d.title,
        category: d.category,
        status: d.status,
        required_by: d.required_by,
        days_until_due: d.required_by ? daysBetween(ctx.today, d.required_by) : null,
        responsible_party: d.provided_by,
        action: ACTION[d.status],
      }));
    const parties = [...new Set(outstanding.map((d) => d.responsible_party))];
    return {
      status: "success",
      data: {
        property: propertyRef(property),
        transaction: transactionRef(tx),
        total_required: docs.length,
        total_outstanding: outstanding.length,
        outstanding,
        by_party: parties.map((party) => ({ party, label: PARTY_LABEL[party] ?? party, count: outstanding.filter((d) => d.responsible_party === party).length })),
      },
      summary: `${outstanding.length} of ${docs.length} required documents outstanding: ${parties.map((p) => `${PARTY_LABEL[p] ?? p} ${outstanding.filter((d) => d.responsible_party === p).length}`).join(", ")}.`,
    };
  },
});

/* ───────────────────────── prepare_document_request ───────────────────────── */

async function recipientName(ctx: ToolContext, party: Party, property: PropertyRow, tx: TransactionRow): Promise<string> {
  if (party === "lender") return (await loanForTransaction(ctx, tx))?.lender_name ?? "Lender";
  if (party === "hoa") return property.hoa_name ?? "Homeowners association";
  return `${PARTY_LABEL[party] ?? party} (${tx.reference})`;
}

export const prepareDocumentRequest = defineTool({
  name: "prepare_document_request",
  title: "Prepare document request",
  version: "1.0.0",
  category: "documents",
  executionClass: "prepare",
  ...operational("prepare"),
  owner: "sagolik-documents",
  requiredScopes: ["documents.read", "documents.prepare"],
  approvalRequired: false,
  idempotency: "key",
  providers: [],
  description: {
    summary: "Draft a request asking the responsible party for a missing, expired, rejected or unsigned document. The draft is saved for review and is not sent.",
    whenToUse: ["When the user wants to chase a specific outstanding document."],
    whenNotToUse: [
      "To send the request — sending requires submit_document_request with closing.execute and human approval.",
      "For documents that are already accepted.",
    ],
    requiredContext: [
      "A transaction_id or property_id.",
      "The document: a document_id, or a category that matches exactly one outstanding document.",
    ],
    effect: "Creates a draft document request in Sagolik. Nothing is sent.",
    example: { request: "Draft a request for the HOA estoppel certificate.", arguments: { property_id: "SGK-1042", category: "hoa" } },
  },
  input: z.strictObject({
    transaction_id: transactionIdInput.optional(),
    property_id: propertyIdInput.optional(),
    document_id: z.uuid().optional(),
    category: documentCategoryEnum.optional(),
    recipient_party: partyEnum.optional().describe("Defaults to the party responsible for the document."),
    message: z.string().trim().max(1000).optional(),
    due_date: z.iso.date().optional(),
    idempotency_key: idempotencyKeyInput,
  }),
  output: z.object({
    request_id: z.string(),
    status: z.literal("draft"),
    property: propertyRefOutput,
    transaction: transactionRefOutput,
    document: z.object({ document_id: z.string(), title: z.string(), status: documentStatusEnum }),
    recipient: z.object({ party: z.string(), name: z.string() }),
    message: z.string(),
    due_date: z.string().nullable(),
    next_step: z.string(),
  }),
})({
  async handler(ctx, input) {
    const resolved = await resolveTransaction(ctx, input);
    if (!resolved.ok) return resolved.outcome;
    const { transaction: tx, property } = resolved.value;
    const outstanding = (await ctx.data.listDocuments({ transactionId: tx.id })).filter((d) => OUTSTANDING.includes(d.status));
    const options = outstanding.map((d) => ({ value: d.id, label: d.title, description: d.status.replaceAll("_", " ") }));

    let doc: DocumentRow | undefined;
    if (input.document_id) {
      doc = outstanding.find((d) => d.id === input.document_id);
      if (!doc) {
        return { status: "needs_clarification", field: "document_id", message: "That document is not outstanding for this transaction.", options };
      }
    } else if (input.category) {
      const matches = outstanding.filter((d) => d.category === input.category);
      if (matches.length !== 1) {
        return {
          status: "needs_clarification",
          field: "document_id",
          message: matches.length === 0 ? `No outstanding ${input.category} document exists for ${tx.reference}.` : `${matches.length} outstanding ${input.category} documents exist; specify document_id.`,
          options: (matches.length ? matches : outstanding).map((d) => ({ value: d.id, label: d.title, description: d.status.replaceAll("_", " ") })),
        };
      }
      doc = matches[0];
    } else {
      return { status: "needs_input", missing_fields: ["document_id"], message: "Specify which outstanding document to request.", options };
    }
    if (!doc) return { status: "needs_input", missing_fields: ["document_id"], message: "Specify which outstanding document to request.", options };

    const party = input.recipient_party ?? doc.provided_by;
    const name = await recipientName(ctx, party, property, tx);
    const due = input.due_date ?? doc.required_by ?? (tx.closing_date ? addDays(tx.closing_date, -5) : null);
    const message =
      input.message ??
      `Please provide the ${doc.title.toLowerCase()} for ${property.address_line1}, ${property.city} (transaction ${tx.reference})${due ? ` by ${due}` : ""}.`;
    const id = ctx.newId();
    const now = ctx.now.toISOString();
    await ctx.data.insertDocumentRequest({
      id,
      organization_id: ctx.organizationId,
      environment: ctx.environment,
      transaction_id: tx.id,
      document_id: doc.id,
      recipient_party: party,
      recipient_name: name,
      message,
      due_date: due,
      status: "draft",
      prepared_by_connection_id: ctx.client.connectionId,
      approval_id: null,
      submitted_at: null,
      created_at: now,
      updated_at: now,
    });
    return {
      status: "success",
      stateChanged: true,
      data: {
        request_id: id,
        status: "draft",
        property: propertyRef(property),
        transaction: transactionRef(tx),
        document: { document_id: doc.id, title: doc.title, status: doc.status },
        recipient: { party, name },
        message,
        due_date: due,
        next_step: "Draft saved. Sending it requires submit_document_request (closing.execute) and explicit human approval.",
      },
      summary: `Drafted a request to ${name} for the ${doc.title}${due ? `, due ${due}` : ""}. Not sent.`,
    };
  },
});

/* ───────────────────────── submit_document_request ───────────────────────── */

export const submitDocumentRequest = defineTool({
  name: "submit_document_request",
  title: "Submit document request",
  version: "1.0.0",
  category: "documents",
  executionClass: "execute",
  ...operational("execute"),
  owner: "sagolik-documents",
  requiredScopes: ["closing.execute"],
  approvalRequired: true,
  idempotency: "approval",
  providers: ["notifications"],
  description: {
    summary: "Send a previously prepared document request to its recipient on the user's behalf.",
    whenToUse: ["Only after the user has reviewed a draft from prepare_document_request and asked for it to be sent."],
    whenNotToUse: ["To draft or preview a request — use prepare_document_request.", "Without a request_id from a prepared draft."],
    requiredContext: [
      "A request_id returned by prepare_document_request.",
      "On the first call Sagolik returns approval_required with an approval_id. After the user approves in Sagolik, call again with the same request_id and that approval_id.",
    ],
    effect: "Contacts an external party on the user's behalf. Requires EXECUTE permission and explicit human approval. The approval is single-use.",
    limitations: ["In the sandbox, delivery is simulated.", "Delivered requests cannot be recalled."],
    example: { request: "Send the estoppel request we drafted.", arguments: { request_id: "00000000-0000-4000-8000-000000000000" } },
  },
  input: z.strictObject({ request_id: z.uuid().describe("request_id from prepare_document_request."), approval_id: approvalIdInput }),
  output: z.object({
    request_id: z.string(),
    status: z.literal("submitted"),
    recipient: z.object({ party: z.string(), name: z.string() }),
    document_title: z.string(),
    delivery: z.enum(["simulated", "delivered"]),
    submitted_at: z.string(),
  }),
})({
  async describeApproval(ctx, input) {
    const request = await ctx.data.getDocumentRequest(input.request_id);
    if (!request) return { status: "needs_clarification", field: "request_id", message: "No prepared document request with that request_id exists. Use prepare_document_request first." };
    if (request.status !== "draft") return { status: "needs_clarification", field: "request_id", message: `This request is already ${request.status}.` };
    const [doc, tx] = await Promise.all([ctx.data.getDocument(request.document_id), ctx.data.getTransaction(request.transaction_id)]);
    const property = tx ? await ctx.data.getProperty(tx.property_id) : null;
    if (!doc || !tx || !property) return { status: "needs_clarification", field: "request_id", message: "The prepared request references records that no longer exist." };
    return {
      action: `send a request for the "${doc.title}" to ${request.recipient_name} for ${propertyLabel(property)}`,
      amountCents: null,
      details: {
        action: "Send document request",
        affected: [
          { kind: "property", reference: property.reference, label: propertyLabel(property) },
          { kind: "document", reference: doc.id, label: doc.title },
        ],
        amount: null,
        provider: ctx.environment === "sandbox" ? "Sagolik notifications (sandbox — delivery simulated)" : "Sagolik notifications",
        expected_result: `${request.recipient_name} receives the request${request.due_date ? `, due ${request.due_date}` : ""}. Sagolik tracks the document's status.`,
        risks: ["An external party will be contacted on your behalf.", "Delivered requests cannot be recalled."],
      },
    };
  },
  async handler(ctx, input) {
    const request = await ctx.data.getDocumentRequest(input.request_id);
    if (!request || request.status !== "draft") {
      return { status: "needs_clarification", field: "request_id", message: "The request is no longer in draft and cannot be submitted again." };
    }
    if (ctx.environment === "production") {
      return {
        status: "unavailable",
        reason: "delivery_provider_not_configured",
        message: "Document-request delivery is not configured for production. The draft remains saved; no one was contacted.",
      };
    }
    ctx.touchProvider("sandbox_notifications");
    const doc = await ctx.data.getDocument(request.document_id);
    const now = ctx.now.toISOString();
    await ctx.data.updateDocumentRequest(request.id, { status: "submitted", submitted_at: now, approval_id: ctx.approval?.id ?? null, updated_at: now });
    return {
      status: "success",
      stateChanged: true,
      data: {
        request_id: request.id,
        status: "submitted",
        recipient: { party: request.recipient_party, name: request.recipient_name },
        document_title: doc?.title ?? "Document",
        delivery: "simulated",
        submitted_at: now,
      },
      summary: `Sent (simulated) the request for the ${doc?.title ?? "document"} to ${request.recipient_name}.`,
      events: [
        {
          type: "document.required",
          payload: { request_id: request.id, document: doc?.title ?? null, recipient_party: request.recipient_party, due_date: request.due_date },
        },
      ],
    };
  },
});
