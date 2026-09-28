import { z } from "zod";
import {
  CLOSING_STAGES,
  DOCUMENT_CATEGORIES,
  DOCUMENT_STATUSES,
  OBLIGATION_KINDS,
} from "@/domain/entities";

/* ───────────── Inputs ───────────── */

export const propertyIdInput = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .describe(
    "Property identifier: a Sagolik reference such as \"SGK-1042\" or a property UUID. Never invent identifiers — obtain them from search_properties.",
  );

export const transactionIdInput = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .describe("Transaction identifier: a Sagolik reference such as \"TX-2026-0419\" or a transaction UUID.");

export const idempotencyKeyInput = z
  .string()
  .trim()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/)
  .optional()
  .describe(
    "Optional client-generated key. Repeating a call with the same key returns the original result instead of creating a duplicate. If omitted, Sagolik derives one from the call.",
  );

export const approvalIdInput = z
  .uuid()
  .optional()
  .describe(
    "Approval identifier returned by a previous approval_required response. Supply it only after the user has approved the request in Sagolik.",
  );

export const moneyAmountInput = (description: string) => z.number().nonnegative().max(1_000_000_000).describe(description);

export const obligationKindEnum = z.enum(OBLIGATION_KINDS);
export const closingStageEnum = z.enum(CLOSING_STAGES);
export const documentCategoryEnum = z.enum(DOCUMENT_CATEGORIES);
export const documentStatusEnum = z.enum(DOCUMENT_STATUSES);
export const frequencyEnum = z.enum(["monthly", "quarterly", "semiannual", "annual"]);
export const severityEnum = z.enum(["critical", "high", "medium", "low"]);
export const partyEnum = z.enum(["buyer", "seller", "lender", "title", "insurance_agent", "hoa", "agent", "sagolik"]);
export const basisEnum = z.enum(["provided", "record", "assumption"]);

/* ───────────── Outputs ───────────── */

export const moneyOutput = z.object({ amount: z.number(), currency: z.literal("USD") });

export const propertyRefOutput = z.object({
  property_id: z.string(),
  reference: z.string(),
  address: z.string(),
  status: z.string(),
});

export const transactionRefOutput = z.object({
  transaction_id: z.string(),
  reference: z.string(),
  closing_date: z.string().nullable(),
});

export const restrictedSection = z.object({
  restricted: z.literal(true),
  required_scope: z.string(),
  reason: z.string(),
});

export const accountRefOutput = z.object({
  account_id: z.string(),
  institution: z.string(),
  name: z.string(),
  mask: z.string(),
});
