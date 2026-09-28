import "server-only";
import type { AccountType, Frequency } from "@/domain/entities";
import type {
  FinancialDataProvider,
  InstitutionMetadata,
  NormalizedAccount,
  NormalizedLiability,
  NormalizedTransaction,
  ProviderContext,
  RecurringStream,
} from "./types";
import { ProviderUnavailableError } from "./types";

/**
 * Plaid adapter. Active only when PLAID_CLIENT_ID and PLAID_SECRET are set.
 * Access tokens are decrypted server-side just-in-time and never returned to
 * callers; all responses are normalized before leaving this module.
 */
export interface PlaidConfig {
  clientId: string;
  secret: string;
  environment: "sandbox" | "production";
}

export type AccessTokenResolver = (integrationConnectionId: string) => Promise<string | null>;

const BASE_URL: Record<PlaidConfig["environment"], string> = {
  sandbox: "https://sandbox.plaid.com",
  production: "https://production.plaid.com",
};

interface PlaidAccount {
  account_id: string;
  name: string;
  official_name: string | null;
  mask: string | null;
  type: string;
  subtype: string | null;
  balances: { available: number | null; current: number | null; iso_currency_code: string | null };
}

const toCents = (n: number | null | undefined) => (n == null ? null : Math.round(n * 100));

function mapType(type: string): AccountType {
  if (type === "depository" || type === "investment" || type === "credit" || type === "loan") return type;
  return "investment";
}

function mapFrequency(freq: string): Frequency | null {
  switch (freq) {
    case "MONTHLY":
      return "monthly";
    case "ANNUALLY":
      return "annual";
    default:
      return null;
  }
}

export class PlaidFinancialProvider implements FinancialDataProvider {
  readonly id = "plaid";
  readonly label = "Plaid";
  readonly environments = ["sandbox", "production"] as const;

  constructor(
    private readonly config: PlaidConfig | null,
    private readonly resolveAccessToken: AccessTokenResolver,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  isConfigured(): boolean {
    return this.config !== null;
  }

  private async call<T>(path: string, body: Record<string, unknown>): Promise<T> {
    if (!this.config) {
      throw new ProviderUnavailableError(this.id, "not_configured", "Plaid is not configured for this deployment.");
    }
    const res = await this.fetchImpl(`${BASE_URL[this.config.environment]}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: this.config.clientId, secret: this.config.secret, ...body }),
      signal: AbortSignal.timeout(10_000),
    });
    const json = (await res.json().catch(() => null)) as (T & { error_code?: string }) | null;
    if (!res.ok || !json) {
      const code = json?.error_code ?? `http_${res.status}`;
      const reason = code === "ITEM_LOGIN_REQUIRED" ? "requires_reauth" : "upstream_error";
      throw new ProviderUnavailableError(this.id, reason, `Plaid request failed (${code}).`);
    }
    return json;
  }

  private async token(ctx: ProviderContext): Promise<string> {
    const integrationId = ctx.connection.integration_connection_id;
    const token = integrationId ? await this.resolveAccessToken(integrationId) : null;
    if (!token) {
      throw new ProviderUnavailableError(this.id, "requires_reauth", "No active Plaid credential for this connection.");
    }
    return token;
  }

  async getAccounts(ctx: ProviderContext): Promise<NormalizedAccount[]> {
    const res = await this.call<{ accounts: PlaidAccount[] }>("/accounts/get", { access_token: await this.token(ctx) });
    const asOf = new Date().toISOString();
    return res.accounts.map((a) => ({
      id: `${ctx.connection.id}:${a.account_id}`,
      financial_connection_id: ctx.connection.id,
      provider_id: this.id,
      institution: ctx.connection.institution_name,
      name: a.official_name ?? a.name,
      mask: a.mask ?? "••••",
      type: mapType(a.type),
      subtype: a.subtype ?? a.type,
      current_balance_cents: toCents(a.balances.current) ?? 0,
      available_balance_cents: toCents(a.balances.available),
      currency: a.balances.iso_currency_code ?? "USD",
      balance_as_of: asOf,
      liquid: a.type === "depository",
    }));
  }

  async getTransactions(ctx: ProviderContext, range: { since: string }): Promise<NormalizedTransaction[]> {
    const end = new Date().toISOString().slice(0, 10);
    const res = await this.call<{
      transactions: {
        transaction_id: string;
        account_id: string;
        amount: number;
        date: string;
        name: string;
        merchant_name: string | null;
        pending: boolean;
        personal_finance_category?: { primary: string } | null;
      }[];
    }>("/transactions/get", {
      access_token: await this.token(ctx),
      start_date: range.since,
      end_date: end,
      options: { count: 500, offset: 0 },
    });
    // Plaid reports outflows as positive amounts; Sagolik uses negative for outflows.
    return res.transactions.map((t) => ({
      id: `${ctx.connection.id}:${t.transaction_id}`,
      account_id: `${ctx.connection.id}:${t.account_id}`,
      posted_on: t.date,
      description: t.name,
      counterparty: t.merchant_name,
      amount_cents: -Math.round(t.amount * 100),
      status: t.pending ? "pending" : "posted",
      category: t.personal_finance_category?.primary?.toLowerCase() ?? null,
    }));
  }

  async getLiabilities(ctx: ProviderContext): Promise<NormalizedLiability[]> {
    const res = await this.call<{
      liabilities: {
        mortgage?: { account_id: string; next_monthly_payment: number | null; next_payment_due_date: string | null }[] | null;
        credit?: { account_id: string; last_statement_balance: number | null; minimum_payment_amount: number | null; next_payment_due_date: string | null }[] | null;
      };
      accounts: PlaidAccount[];
    }>("/liabilities/get", { access_token: await this.token(ctx) });
    const balance = (id: string) => toCents(res.accounts.find((a) => a.account_id === id)?.balances.current) ?? 0;
    const out: NormalizedLiability[] = [];
    for (const m of res.liabilities.mortgage ?? []) {
      out.push({
        account_id: `${ctx.connection.id}:${m.account_id}`,
        kind: "mortgage",
        balance_cents: balance(m.account_id),
        minimum_payment_cents: toCents(m.next_monthly_payment),
        next_payment_due: m.next_payment_due_date,
      });
    }
    for (const c of res.liabilities.credit ?? []) {
      out.push({
        account_id: `${ctx.connection.id}:${c.account_id}`,
        kind: "credit",
        balance_cents: toCents(c.last_statement_balance) ?? balance(c.account_id),
        minimum_payment_cents: toCents(c.minimum_payment_amount),
        next_payment_due: c.next_payment_due_date,
      });
    }
    return out;
  }

  async getRecurringObligations(ctx: ProviderContext): Promise<RecurringStream[]> {
    const res = await this.call<{
      outflow_streams: {
        account_id: string;
        merchant_name: string | null;
        description: string;
        frequency: string;
        average_amount: { amount: number };
        last_date: string;
        predicted_next_date: string | null;
        status: string;
        transaction_ids: string[];
      }[];
    }>("/transactions/recurring/get", { access_token: await this.token(ctx) });
    const streams: RecurringStream[] = [];
    for (const s of res.outflow_streams) {
      const frequency = mapFrequency(s.frequency);
      if (!frequency || s.status === "TOMBSTONED" || !s.predicted_next_date) continue;
      streams.push({
        account_id: `${ctx.connection.id}:${s.account_id}`,
        counterparty: s.merchant_name ?? s.description,
        frequency,
        typical_amount_cents: Math.round(Math.abs(s.average_amount.amount) * 100),
        occurrences: s.transaction_ids.length,
        last_date: s.last_date,
        next_expected: s.predicted_next_date,
        confidence: s.status === "MATURE" ? "high" : "medium",
      });
    }
    return streams;
  }

  async getInstitution(ctx: ProviderContext): Promise<InstitutionMetadata> {
    return { name: ctx.connection.institution_name, status: ctx.connection.status === "active" ? "healthy" : "degraded" };
  }

  /** Create a Link token for the console's account-connection flow. */
  async createLinkToken(userId: string): Promise<string> {
    const res = await this.call<{ link_token: string }>("/link/token/create", {
      user: { client_user_id: userId },
      client_name: "Sagolik",
      products: ["transactions"],
      optional_products: ["liabilities"],
      country_codes: ["US"],
      language: "en",
    });
    return res.link_token;
  }

  /** Exchange a Link public token. The returned access token must be encrypted before storage. */
  async exchangePublicToken(publicToken: string): Promise<{ accessToken: string; itemId: string }> {
    const res = await this.call<{ access_token: string; item_id: string }>("/item/public_token/exchange", {
      public_token: publicToken,
    });
    return { accessToken: res.access_token, itemId: res.item_id };
  }
}
