import { detectRecurringSeries } from "@/domain/finance/recurrence";
import type { DomainStore } from "@/server/store/types";
import type { FinancialDataProvider, NormalizedAccount, ProviderContext } from "./types";
import { ProviderUnavailableError } from "./types";

/**
 * Sandbox financial-data provider. Serves synthetic accounts stored in the
 * sandbox environment. It refuses to operate outside the sandbox.
 */
export class SandboxFinancialProvider implements FinancialDataProvider {
  readonly id: string;
  readonly label = "Sagolik Sandbox Bank (simulated)";
  readonly environments = ["sandbox"] as const;

  constructor(private readonly store: DomainStore, id = "sandbox_bank") {
    this.id = id;
  }

  isConfigured(): boolean {
    return true;
  }

  private guard(ctx: ProviderContext) {
    if (ctx.scope.environment !== "sandbox") {
      throw new ProviderUnavailableError(this.id, "environment_mismatch", "The sandbox provider cannot serve production data.");
    }
  }

  async getAccounts(ctx: ProviderContext): Promise<NormalizedAccount[]> {
    this.guard(ctx);
    const accounts = await this.store.listAccounts(ctx.scope);
    return accounts
      .filter((a) => a.financial_connection_id === ctx.connection.id)
      .map((a) => ({
        id: a.id,
        financial_connection_id: a.financial_connection_id,
        provider_id: this.id,
        institution: ctx.connection.institution_name,
        name: a.name,
        mask: a.mask,
        type: a.type,
        subtype: a.subtype,
        current_balance_cents: a.current_balance_cents,
        available_balance_cents: a.available_balance_cents,
        currency: a.currency,
        balance_as_of: a.balance_as_of,
        liquid: a.type === "depository",
      }));
  }

  async getTransactions(ctx: ProviderContext, range: { since: string }) {
    this.guard(ctx);
    const accountIds = (await this.getAccounts(ctx)).map((a) => a.id);
    if (accountIds.length === 0) return [];
    const rows = await this.store.listAccountTransactions(ctx.scope, { accountIds, since: range.since });
    return rows.map((t) => ({
      id: t.id,
      account_id: t.account_id,
      posted_on: t.posted_on,
      description: t.description,
      counterparty: t.counterparty,
      amount_cents: t.amount_cents,
      status: t.status,
      category: t.category,
    }));
  }

  async getLiabilities() {
    return [];
  }

  async getRecurringObligations(ctx: ProviderContext) {
    this.guard(ctx);
    const accountIds = (await this.getAccounts(ctx)).map((a) => a.id);
    if (accountIds.length === 0) return [];
    const rows = await this.store.listAccountTransactions(ctx.scope, { accountIds });
    return detectRecurringSeries(rows).map((s) => ({
      account_id: s.account_id,
      counterparty: s.counterparty,
      frequency: s.frequency,
      typical_amount_cents: s.typical_amount_cents,
      occurrences: s.occurrences,
      last_date: s.last_posted_on,
      next_expected: s.next_expected_on,
      confidence: s.confidence,
    }));
  }

  async getInstitution(ctx: ProviderContext) {
    return { name: ctx.connection.institution_name, status: "healthy" as const };
  }
}
