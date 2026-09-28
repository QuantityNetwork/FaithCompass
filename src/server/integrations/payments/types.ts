import type { Environment } from "@/domain/environments";
import type { AutopilotPlanItem } from "@/domain/entities";

/**
 * Payment-instruction providers schedule recurring payments with a regulated
 * partner. Sagolik itself never holds or moves funds. When no provider is
 * configured for an environment, Autopilot operates in reminder-only mode.
 */
export interface PaymentInstructionRequest {
  organizationId: string;
  environment: Environment;
  propertyReference: string;
  item: AutopilotPlanItem;
  fundingAccountId: string;
  idempotencyKey: string;
}

export interface PaymentInstructionResult {
  providerReference: string;
  mode: "simulated" | "provider_scheduled";
}

export interface PaymentInstructionProvider {
  readonly id: string;
  readonly label: string;
  readonly environments: readonly Environment[];
  scheduleRecurring(request: PaymentInstructionRequest): Promise<PaymentInstructionResult>;
}

/** Sandbox provider: records a simulated schedule. No funds move. */
export class SandboxPaymentProvider implements PaymentInstructionProvider {
  readonly id = "sandbox_payments";
  readonly label = "Sandbox payments (simulated)";
  readonly environments = ["sandbox"] as const;

  async scheduleRecurring(request: PaymentInstructionRequest): Promise<PaymentInstructionResult> {
    if (request.environment !== "sandbox") {
      throw new Error("Sandbox payment provider cannot be used outside the sandbox.");
    }
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(request.idempotencyKey));
    const ref = Array.from(new Uint8Array(digest).slice(0, 6), (b) => b.toString(16).padStart(2, "0")).join("");
    return { providerReference: `sbx_pmt_${ref}`, mode: "simulated" };
  }
}
