import type { FinancialConnectionRow } from "@/domain/entities";
import type { DomainStore, TenantScope } from "@/server/store/types";
import type { FinancialDataProvider, NormalizedAccount, NormalizedTransaction, RecurringStream } from "./types";
import { ProviderUnavailableError } from "./types";

export interface ProviderIssue {
  provider_id: string;
  institution: string;
  reason: string;
  message: string;
}

interface Aggregate<T> {
  items: T[];
  issues: ProviderIssue[];
}

/**
 * Aggregates normalized financial data across every connection in the tenant
 * scope. Tools never talk to providers directly; they receive normalized data
 * plus structured issues when a provider is unavailable.
 */
export class FinancialDataService {
  constructor(
    private readonly store: DomainStore,
    private readonly providers: ReadonlyMap<string, FinancialDataProvider>,
    private readonly scope: TenantScope,
    private readonly touch: (providerId: string) => void,
  ) {}

  connections(): Promise<FinancialConnectionRow[]> {
    return this.store.listFinancialConnections(this.scope);
  }

  providerFor(connection: FinancialConnectionRow): FinancialDataProvider | null {
    return this.providers.get(connection.provider_id) ?? null;
  }

  private async collect<T>(fn: (provider: FinancialDataProvider, connection: FinancialConnectionRow) => Promise<T[]>): Promise<Aggregate<T>> {
    const connections = (await this.connections()).filter((c) => c.status !== "disconnected");
    const items: T[] = [];
    const issues: ProviderIssue[] = [];
    for (const connection of connections) {
      const provider = this.providerFor(connection);
      if (!provider) {
        issues.push({ provider_id: connection.provider_id, institution: connection.institution_name, reason: "unknown_provider", message: "Provider adapter is not installed." });
        continue;
      }
      if (!provider.environments.includes(this.scope.environment)) {
        issues.push({ provider_id: provider.id, institution: connection.institution_name, reason: "environment_mismatch", message: `${provider.label} is not available in ${this.scope.environment}.` });
        continue;
      }
      if (connection.status === "requires_reauth") {
        issues.push({ provider_id: provider.id, institution: connection.institution_name, reason: "requires_reauth", message: "The account holder must re-authenticate this connection." });
        continue;
      }
      try {
        this.touch(provider.id);
        items.push(...(await fn(provider, connection)));
      } catch (error) {
        const reason = error instanceof ProviderUnavailableError ? error.reason : "upstream_error";
        issues.push({ provider_id: provider.id, institution: connection.institution_name, reason, message: "Data from this institution is temporarily unavailable." });
      }
    }
    return { items, issues };
  }

  accounts(): Promise<Aggregate<NormalizedAccount>> {
    return this.collect((p, connection) => p.getAccounts({ scope: this.scope, connection }));
  }

  transactions(since: string): Promise<Aggregate<NormalizedTransaction>> {
    return this.collect((p, connection) => p.getTransactions({ scope: this.scope, connection }, { since }));
  }

  recurring(): Promise<Aggregate<RecurringStream>> {
    return this.collect((p, connection) => p.getRecurringObligations({ scope: this.scope, connection }));
  }
}
