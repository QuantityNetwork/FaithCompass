import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";

export const metadata = {
  title: "Security",
  description: "How Sagolik MCP controls what AI agents can see and do.",
};

const SECTIONS: { title: string; body: string; points: string[] }[] = [
  {
    title: "Authorization",
    body: "Authentication establishes who is calling. Authorization is decided separately, on every call, by a policy engine that records its reasoning.",
    points: [
      "Each call is evaluated against tool status, environment, session, scopes, per-tool restrictions, connection and role ceilings, production guard, transaction limits and approval requirements.",
      "Agents only discover the tools they may invoke.",
      "Denials are explained in structured form so agents can tell the user exactly what is missing.",
    ],
  },
  {
    title: "Scoped access",
    body: "Every connection holds an explicit set of scopes. There are no wildcards and no implicit grants.",
    points: [
      "New connections default to read and simulate only.",
      "EXECUTE scopes are never pre-selected and remain subject to approval.",
      "Individual tools can be disabled for a single connection.",
    ],
  },
  {
    title: "Human approvals",
    body: "Actions that change real-world state stop for a person. The request says precisely who is asking, to do what, to which asset, for how much, and with which risks.",
    points: [
      "Approvals are bound to one connection, one tool and a fingerprint of the exact arguments.",
      "They are single-use and expire; replays return the original result.",
      "Only members whose role permits the action class can approve.",
    ],
  },
  {
    title: "Sandbox isolation",
    body: "The sandbox is a separate environment with synthetic data and simulated providers, designed so that sandbox activity cannot affect production.",
    points: [
      "Tokens are environment-bound and rejected by the other endpoint.",
      "Database foreign keys include the environment, so sandbox rows cannot reference production rows.",
      "Sandbox providers are prohibited from production data by database constraints.",
    ],
  },
  {
    title: "Auditability",
    body: "Every invocation — allowed, denied, rate-limited or awaiting approval — is written to an append-only audit trail.",
    points: [
      "Records include who, which agent, which tool, the policy decision and reasons, approval state, outcome, duration and providers touched.",
      "Arguments are recorded as a hash, not stored verbatim.",
      "Records are hash-chained per organization; updates and deletes are rejected by the database.",
    ],
  },
  {
    title: "Tenant isolation",
    body: "Families, businesses, wealth structures and institutions share infrastructure, never data.",
    points: [
      "Row Level Security is enabled on every table; browser roles can read only their own organizations and can write nothing.",
      "Organization context is derived from the authenticated identity and membership — never from request input.",
      "Tool handlers receive a data accessor bound to a single organization and environment.",
    ],
  },
  {
    title: "Encryption and secrets",
    body: "Secrets never reach agents or browsers.",
    points: [
      "Access tokens, refresh tokens, authorization codes and client secrets are stored only as SHA-256 hashes.",
      "Webhook signing secrets and provider credentials are encrypted with AES-256-GCM using a server-held key.",
      "Privileged database credentials exist only in server-side environment variables.",
    ],
  },
  {
    title: "Revocation",
    body: "Access can be withdrawn instantly and completely.",
    points: [
      "Revoking a connection invalidates all of its sessions on the next request.",
      "Removing a member or changing a role takes effect immediately for their agents.",
      "Refresh-token reuse or authorization-code replay revokes the affected connection automatically.",
    ],
  },
  {
    title: "Idempotency",
    body: "Agents retry. Sagolik is designed so retries do not duplicate actions.",
    points: [
      "PREPARE tools deduplicate by idempotency key, derived automatically when the agent does not supply one.",
      "EXECUTE tools are idempotent through single-use approvals.",
      "Loop protection rejects identical calls repeated within a minute.",
    ],
  },
  {
    title: "Provider isolation",
    body: "External providers sit behind provider-neutral adapters.",
    points: [
      "Agents receive normalized data — never provider tokens, raw identifiers or full account numbers.",
      "Sagolik is not architecturally dependent on any single provider.",
      "Sagolik does not hold or move funds; payment execution occurs only through connected, regulated providers.",
    ],
  },
];

export default function SecurityPage() {
  return (
    <>
      <section className="border-b border-line bg-surface">
        <div className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 sm:py-20">
          <p className="eyebrow">Security</p>
          <h1 className="mt-4 max-w-3xl text-[44px] font-semibold leading-[1.05] tracking-[-0.03em]">An AI agent may understand more than it is allowed to do.</h1>
          <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-muted">
            Sagolik MCP is designed so that AI agents never receive uncontrolled access to Sagolik. Every capability is explicit, every action with real-world effect requires a human, and every call is recorded.
          </p>
        </div>
      </section>
      <section className="mx-auto max-w-[1200px] px-4 py-12 sm:px-6 sm:py-16">
        <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-2">
          {SECTIONS.map((s) => (
            <div key={s.title} className="bg-canvas p-8">
              <h2 className="text-[19px] font-semibold tracking-[-0.015em]">{s.title}</h2>
              <p className="mt-2 text-[14.5px] leading-relaxed text-body">{s.body}</p>
              <ul className="mt-4 space-y-2">
                {s.points.map((p) => (
                  <li key={p} className="flex gap-2.5 text-[13.5px] leading-relaxed text-muted">
                    <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-brand" aria-hidden />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 rounded-xl border border-line bg-surface px-8 py-7">
          <h2 className="text-[16px] font-semibold">Compliance</h2>
          <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-muted">
            Sagolik MCP is designed to support the controls institutions expect — least privilege, human authorization, tenant isolation, encryption of secrets and tamper-evident audit trails. This page describes architecture; it does not claim any certification or attestation. Contact Sagolik for current assurance documentation.
          </p>
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <ButtonLink href="/docs/security">Technical details</ButtonLink>
          <ButtonLink href="/docs/permissions" variant="secondary">
            Permission model
          </ButtonLink>
          <Link href="/docs/approvals" className="inline-flex h-9 items-center px-2 text-[13.5px] text-link hover:underline">
            How approvals work →
          </Link>
        </div>
      </section>
    </>
  );
}
