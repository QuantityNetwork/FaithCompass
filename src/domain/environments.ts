export const ENVIRONMENTS = ["sandbox", "production"] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

export const DEFAULT_ENVIRONMENT: Environment = "sandbox";

export const ENVIRONMENT_META: Record<
  Environment,
  { label: string; tokenPrefix: "test" | "live"; mcpPath: string; description: string }
> = {
  sandbox: {
    label: "Sandbox",
    tokenPrefix: "test",
    mcpPath: "/sandbox/mcp",
    description: "Isolated synthetic data. Simulated providers. No production records are affected.",
  },
  production: {
    label: "Production",
    tokenPrefix: "live",
    mcpPath: "/mcp",
    description: "Live Sagolik records. Every action is authorized, policy-checked and audited.",
  },
};

export function isEnvironment(value: unknown): value is Environment {
  return typeof value === "string" && (ENVIRONMENTS as readonly string[]).includes(value);
}

export function parseEnvironment(value: unknown, fallback: Environment = DEFAULT_ENVIRONMENT): Environment {
  return isEnvironment(value) ? value : fallback;
}
