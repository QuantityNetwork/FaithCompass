export interface DocLink {
  slug: string;
  title: string;
  description: string;
}

export const DOC_GROUPS: { label: string; links: DocLink[] }[] = [
  {
    label: "Getting started",
    links: [
      { slug: "", title: "Introduction", description: "What Sagolik MCP is and how it controls agent authority." },
      { slug: "quick-start", title: "Quick start", description: "Connect an agent to the sandbox and run your first tool." },
    ],
  },
  {
    label: "Connect",
    links: [
      { slug: "connect-claude", title: "Connect Claude", description: "claude.ai, Claude Desktop and Claude Code." },
      { slug: "connect-chatgpt", title: "Connect ChatGPT", description: "Add Sagolik as a ChatGPT connector." },
      { slug: "connect-cursor", title: "Connect Cursor", description: "Configure Cursor with a scoped connection token." },
    ],
  },
  {
    label: "Concepts",
    links: [
      { slug: "authentication", title: "Authentication", description: "OAuth 2.1, PKCE, dynamic registration and connection tokens." },
      { slug: "permissions", title: "Permissions", description: "Execution classes, scopes, roles and per-tool restrictions." },
      { slug: "environments", title: "Environments", description: "Sandbox and production, and why they never mix." },
      { slug: "approvals", title: "Approvals", description: "Human-in-the-loop authorization for EXECUTE actions." },
      { slug: "audit", title: "Audit", description: "The append-only, hash-chained record of every call." },
    ],
  },
  {
    label: "Reference",
    links: [
      { slug: "tools", title: "Tools", description: "Every tool, by category and execution class." },
      { slug: "tool-schemas", title: "Tool schemas", description: "Input and output JSON Schemas, and the response envelope." },
      { slug: "errors", title: "Errors", description: "Structured statuses and error codes." },
      { slug: "webhooks", title: "Webhooks", description: "Events, payloads, signatures and retries." },
      { slug: "versioning", title: "Versioning", description: "Tool versions, deprecation and retirement." },
    ],
  },
  {
    label: "Trust",
    links: [
      { slug: "security", title: "Security", description: "The security model in depth." },
      { slug: "changelog", title: "Changelog", description: "Release history." },
    ],
  },
];

export const ALL_DOCS: DocLink[] = DOC_GROUPS.flatMap((g) => g.links);
