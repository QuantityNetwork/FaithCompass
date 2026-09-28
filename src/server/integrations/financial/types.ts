import type { AccountType, FinancialConnectionRow, Frequency, ISODate } from "@/domain/entities";
import type { Environment } from "@/domain/environments";
import type { TenantScope } from "@/server/store/types";

/**
 * Provider-neutral financial data contracts. Every provider adapter maps its
 * native responses into these shapes. Raw provider identifiers, access tokens
 * and unmasked account numbers never leave the adapter.
 */
export interface NormalizedAccount {
  id: string;
  financial_connection_id: string;
  provider_id: string;
  institution: string;
  name: string;
  mask: string;
  type: AccountType;
  subtype: string;
  current_balance_cents: number;
  available_balance_cents: number | null;
  currency: string;
  balance_as_of: string;
  /** Depository accounts are treated as liquid for closing-funds analysis. */
  liquid: boolean;
}

export interface NormalizedTransaction {
  id: string;
  account_id: string;
  posted_on: ISODate;
  description: string;
  counterparty: string | null;
  amount_cents: number;
  status: "pending" | "posted";
  category: string | null;
}

export interface NormalizedLiability {
  account_id: string;
  kind: "mortgage" | "student" | "credit" | "other";
  balance_cents: number;
  minimum_payment_cents: number | null;
  next_payment_due: ISODate | null;
}

export interface RecurringStream {
  account_id: string;
  counterparty: string;
  frequency: Frequency;
  typical_amount_cents: number;
  occurrences: number;
  last_date: ISODate;
  next_expected: ISODate;
  confidence: "high" | "medium";
}

export interface InstitutionMetadata {
  name: string;
  status: "healthy" | "degraded" | "unknown";
}

export interface ProviderContext {
  scope: TenantScope;
  connection: FinancialConnectionRow;
}

export interface FinancialDataProvider {
  readonly id: string;
  readonly label: string;
  readonly environments: readonly Environment[];
  isConfigured(): boolean;
  getAccounts(ctx: ProviderContext): Promise<NormalizedAccount[]>;
  getTransactions(ctx: ProviderContext, range: { since: ISODate }): Promise<NormalizedTransaction[]>;
  getLiabilities(ctx: ProviderContext): Promise<NormalizedLiability[]>;
  getRecurringObligations(ctx: ProviderContext): Promise<RecurringStream[]>;
  getInstitution(ctx: ProviderContext): Promise<InstitutionMetadata>;
}

export class ProviderUnavailableError extends Error {
  constructor(
    readonly providerId: string,
    readonly reason: "not_configured" | "requires_reauth" | "upstream_error" | "environment_mismatch",
    message: string,
  ) {
    super(message);
    this.name = "ProviderUnavailableError";
  }
}
