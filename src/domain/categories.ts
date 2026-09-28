export const TOOL_CATEGORIES = [
  "property",
  "financing",
  "closing",
  "documents",
  "cashflow",
  "ownership",
  "autopilot",
  "identity",
  "integrations",
  "administration",
] as const;
export type ToolCategory = (typeof TOOL_CATEGORIES)[number];

export const CATEGORY_META: Record<ToolCategory, { label: string; description: string }> = {
  property: { label: "Property", description: "Property records and acquisition analysis." },
  financing: { label: "Financing", description: "Loan status and financing scenarios." },
  closing: { label: "Closing", description: "Closing lifecycle, blockers and funds readiness." },
  documents: { label: "Documents", description: "Transaction document inventory and requests." },
  cashflow: { label: "Cash Flow", description: "Connected accounts and recurring property costs." },
  ownership: { label: "Ownership", description: "Ownership profile and the property homebook." },
  autopilot: { label: "Autopilot", description: "Obligation tracking and controlled automation." },
  identity: { label: "Identity", description: "The agent's own authorization context." },
  integrations: { label: "Integrations", description: "Normalized status of external providers." },
  administration: { label: "Administration", description: "Approvals and governance." },
};
