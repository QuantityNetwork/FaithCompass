import type { Environment } from "@/domain/environments";
import type { DomainStore } from "@/server/store/types";
import { SandboxFinancialProvider } from "./financial/sandbox-provider";
import type { FinancialDataProvider } from "./financial/types";
import { SandboxPaymentProvider, type PaymentInstructionProvider } from "./payments/types";

export interface ProviderCatalogEntry {
  id: string;
  name: string;
  kind: "financial_data" | "payments" | "documents" | "notifications";
  environments: Environment[];
  description: string;
}

/** Static catalog of provider adapters known to this deployment. */
export const PROVIDER_CATALOG: ProviderCatalogEntry[] = [
  {
    id: "plaid",
    name: "Plaid",
    kind: "financial_data",
    environments: ["sandbox", "production"],
    description: "Open-banking data: accounts, balances, transactions, liabilities and recurring streams.",
  },
  {
    id: "sandbox_bank",
    name: "Sagolik Sandbox Bank",
    kind: "financial_data",
    environments: ["sandbox"],
    description: "Synthetic accounts and transactions for development. Never available in production.",
  },
  {
    id: "sandbox_payments",
    name: "Sandbox payments",
    kind: "payments",
    environments: ["sandbox"],
    description: "Simulated payment scheduling for Autopilot testing. No funds move.",
  },
];

export interface ProviderFactoryOptions {
  plaid?: FinancialDataProvider | null;
}

export function createFinancialProviders(store: DomainStore, options: ProviderFactoryOptions = {}): Map<string, FinancialDataProvider> {
  const providers = new Map<string, FinancialDataProvider>();
  providers.set("sandbox_bank", new SandboxFinancialProvider(store, "sandbox_bank"));
  if (options.plaid) providers.set("plaid", options.plaid);
  return providers;
}

/** Payment providers by environment. Production has no live provider configured. */
export function paymentProviderFor(environment: Environment): PaymentInstructionProvider | null {
  return environment === "sandbox" ? new SandboxPaymentProvider() : null;
}
