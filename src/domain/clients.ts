export const CLIENT_TYPES = ["claude", "chatgpt", "cursor", "sagolik_agent", "custom"] as const;
export type ClientType = (typeof CLIENT_TYPES)[number];

export const CLIENT_META: Record<ClientType, { label: string; monogram: string; auth: ("oauth" | "token")[] }> = {
  claude: { label: "Claude", monogram: "Cl", auth: ["oauth", "token"] },
  chatgpt: { label: "ChatGPT", monogram: "Gp", auth: ["oauth"] },
  cursor: { label: "Cursor", monogram: "Cu", auth: ["token", "oauth"] },
  sagolik_agent: { label: "Sagolik Agent", monogram: "Sg", auth: ["token"] },
  custom: { label: "Custom MCP client", monogram: "Mc", auth: ["token", "oauth"] },
};

export function isClientType(value: unknown): value is ClientType {
  return typeof value === "string" && (CLIENT_TYPES as readonly string[]).includes(value);
}

/** Infer a client type from an OAuth dynamic-registration payload. Used only for display. */
export function inferClientType(name: string, redirectUris: string[]): ClientType {
  const haystack = `${name} ${redirectUris.join(" ")}`.toLowerCase();
  if (haystack.includes("claude") || haystack.includes("anthropic")) return "claude";
  if (haystack.includes("chatgpt") || haystack.includes("openai")) return "chatgpt";
  if (haystack.includes("cursor")) return "cursor";
  return "custom";
}
