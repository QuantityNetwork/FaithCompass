import type { PropertyRow, PropertyStatus, TransactionRow } from "@/domain/entities";
import { formatAddress } from "./format";
import type { ClarificationOption, NonSuccessOutcome, ToolContext } from "./types";

type Resolved<T> = { ok: true; value: T } | { ok: false; outcome: NonSuccessOutcome };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PROPERTY_REF = /^SGK-\d{3,}$/i;
const TRANSACTION_REF = /^TX-\d{4}-\d{3,}$/i;

const propertyOption = (p: PropertyRow): ClarificationOption => ({
  value: p.reference,
  label: formatAddress(p),
  description: `Status: ${p.status.replace("_", " ")}`,
});

async function lookupProperty(ctx: ToolContext, ref: string): Promise<PropertyRow | null> {
  if (UUID.test(ref)) return ctx.data.getProperty(ref);
  if (PROPERTY_REF.test(ref)) return ctx.data.getPropertyByReference(ref.toUpperCase());
  return null;
}

/**
 * Resolve a property identifier supplied by an agent. Identifiers are matched
 * exactly; free text is never interpreted as an identifier. Missing or unknown
 * identifiers produce structured needs_input / needs_clarification outcomes.
 */
export async function resolveProperty(
  ctx: ToolContext,
  ref: string | undefined,
  options: { field?: string; statuses?: PropertyStatus[]; purpose?: string } = {},
): Promise<Resolved<PropertyRow>> {
  const field = options.field ?? "property_id";
  const candidates = await ctx.data.listProperties(options.statuses ? { statuses: options.statuses } : undefined);

  if (!ref) {
    return {
      ok: false,
      outcome: {
        status: "needs_input",
        missing_fields: [field],
        message:
          candidates.length > 0
            ? `A property must be selected${options.purpose ? ` ${options.purpose}` : ""}. ${candidates.length} eligible ${candidates.length === 1 ? "property is" : "properties are"} available; call again with ${field}.`
            : `A property must be selected${options.purpose ? ` ${options.purpose}` : ""}, but no eligible properties exist in this environment.`,
        options: candidates.slice(0, 10).map(propertyOption),
      },
    };
  }

  const property = await lookupProperty(ctx, ref);
  if (!property) {
    const looksLikeText = !UUID.test(ref) && !PROPERTY_REF.test(ref);
    const matches = looksLikeText ? await ctx.data.listProperties({ query: ref }) : [];
    return {
      ok: false,
      outcome: {
        status: "needs_clarification",
        field,
        message: looksLikeText
          ? `"${ref}" is not a property identifier. ${matches.length ? "Possible matches are listed; " : ""}call again with an exact property_id such as a reference from search_properties.`
          : `No property "${ref}" exists for this organization in the ${ctx.environment} environment. Do not guess identifiers; use search_properties.`,
        options: (matches.length ? matches : candidates).slice(0, 10).map(propertyOption),
      },
    };
  }

  if (options.statuses && !options.statuses.includes(property.status)) {
    return {
      ok: false,
      outcome: {
        status: "needs_clarification",
        field,
        message: `Property ${property.reference} has status "${property.status}", which is not eligible${options.purpose ? ` ${options.purpose}` : ""}. Eligible statuses: ${options.statuses.join(", ")}.`,
        options: candidates.slice(0, 10).map(propertyOption),
      },
    };
  }

  return { ok: true, value: property };
}

/**
 * Resolve the transaction for a call. Accepts an explicit transaction
 * identifier, or a property identifier with exactly one active transaction.
 */
export async function resolveTransaction(
  ctx: ToolContext,
  input: { transaction_id?: string; property_id?: string },
  options: { includeClosed?: boolean } = {},
): Promise<Resolved<{ transaction: TransactionRow; property: PropertyRow }>> {
  if (input.transaction_id) {
    const ref = input.transaction_id;
    const tx = UUID.test(ref)
      ? await ctx.data.getTransaction(ref)
      : TRANSACTION_REF.test(ref)
        ? await ctx.data.getTransactionByReference(ref.toUpperCase())
        : null;
    if (!tx) {
      const active = await ctx.data.listTransactions({ status: "active" });
      return {
        ok: false,
        outcome: {
          status: "needs_clarification",
          field: "transaction_id",
          message: `No transaction "${ref}" exists for this organization in the ${ctx.environment} environment. Do not guess identifiers.`,
          options: active.map((t) => ({ value: t.reference, label: `Transaction ${t.reference}`, description: `Closing ${t.closing_date ?? "date not set"}` })),
        },
      };
    }
    const property = await ctx.data.getProperty(tx.property_id);
    if (!property) throw new Error("Transaction references a missing property");
    return { ok: true, value: { transaction: tx, property } };
  }

  if (!input.property_id) {
    const active = await ctx.data.listTransactions({ status: "active" });
    const properties = await Promise.all(active.map((t) => ctx.data.getProperty(t.property_id)));
    return {
      ok: false,
      outcome: {
        status: "needs_input",
        missing_fields: ["property_id"],
        message:
          active.length > 0
            ? `Specify which transaction. ${active.length} ${active.length === 1 ? "property is" : "properties are"} currently in closing; call again with property_id or transaction_id.`
            : "Specify a property_id or transaction_id. There are no active transactions in this environment.",
        options: active.map((t, i) => ({
          value: properties[i]?.reference ?? t.reference,
          label: properties[i] ? formatAddress(properties[i]) : t.reference,
          description: `Transaction ${t.reference}, closing ${t.closing_date ?? "not scheduled"}`,
        })),
      },
    };
  }

  const resolved = await resolveProperty(ctx, input.property_id);
  if (!resolved.ok) return resolved;
  const property = resolved.value;
  const all = await ctx.data.listTransactions({ propertyId: property.id });
  const eligible = options.includeClosed ? all : all.filter((t) => t.status === "active");
  if (eligible.length === 0) {
    return {
      ok: false,
      outcome: {
        status: "needs_clarification",
        field: "property_id",
        message: `Property ${property.reference} has no ${options.includeClosed ? "" : "active "}purchase transaction. Closing tools apply only to properties in a transaction.`,
      },
    };
  }
  if (eligible.length > 1) {
    return {
      ok: false,
      outcome: {
        status: "needs_clarification",
        field: "transaction_id",
        message: `Property ${property.reference} has more than one transaction. Specify transaction_id.`,
        options: eligible.map((t) => ({ value: t.reference, label: `Transaction ${t.reference}`, description: t.status })),
      },
    };
  }
  return { ok: true, value: { transaction: eligible[0]!, property } };
}
