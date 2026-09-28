import { ButtonLink } from "@/components/ui/button";
import { CodeBlock } from "@/components/ui/code-block";

export const metadata = {
  title: "Sandbox",
  description: "An isolated Sagolik environment with synthetic properties, accounts and closings.",
};

const PUBLIC_URL = process.env.SAGOLIK_PUBLIC_URL ?? "https://mcp.sagolik.com";

const DATASET = [
  { ref: "SGK-1042", address: "245 Mercer Avenue, Austin, TX", status: "In closing", detail: "$875,000 purchase · $656,250 loan · 25% down · closes in four weeks · four open blockers" },
  { ref: "SGK-1017", address: "1106 Juniper Street, Austin, TX", status: "Owned", detail: "Escrowed mortgage · Autopilot partially active with one failed rule · full homebook" },
  { ref: "SGK-1063", address: "72 Wren Hollow Road, Dripping Springs, TX", status: "Prospective", detail: "$1,195,000 list price · for acquisition analysis and financing scenarios" },
];

export default function SandboxPage() {
  return (
    <>
      <section className="border-b border-sandbox/20 bg-sandbox-soft">
        <div className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 sm:py-20">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-sandbox">Sandbox environment</p>
          <h1 className="mt-4 max-w-3xl text-[44px] font-semibold leading-[1.05] tracking-[-0.03em]">Build against Sagolik without touching a real record.</h1>
          <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-body">
            The sandbox mirrors production behaviour — the same tools, policy engine, approvals and audit — with synthetic data and simulated providers. Every new connection starts here.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/connections/new">Connect to the sandbox</ButtonLink>
            <ButtonLink href="/tools/explorer" variant="secondary">
              Open Tool Explorer
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] px-4 py-12 sm:px-6 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-[24px] font-semibold tracking-[-0.02em]">Endpoint</h2>
            <p className="mt-2 text-[15px] text-muted">Sandbox tokens begin with sgk_test_ and are rejected by the production endpoint.</p>
            <CodeBlock className="mt-5" code={`${PUBLIC_URL}/sandbox/mcp`} title="Streamable HTTP · JSON-RPC 2.0" />
          </div>
          <div>
            <h2 className="text-[24px] font-semibold tracking-[-0.02em]">Guarantees</h2>
            <ul className="mt-4 space-y-3 text-[14.5px] leading-relaxed text-body">
              <li>Isolated data per organization, enforced by the database.</li>
              <li>Synthetic transactions, test properties and mock financial accounts.</li>
              <li>Simulated closing workflows and simulated payment scheduling — no funds move.</li>
              <li>Test webhook delivery with signed events.</li>
              <li>Safe tool execution, including approval flows for EXECUTE tools.</li>
            </ul>
          </div>
        </div>

        <h2 className="mt-16 text-[24px] font-semibold tracking-[-0.02em]">Synthetic dataset</h2>
        <p className="mt-2 text-[15px] text-muted">All institutions, counterparties and accounts are fictional. Dates are anchored to the day the sandbox is created or reset.</p>
        <div className="mt-6 overflow-hidden rounded-xl border border-line">
          {DATASET.map((p, i) => (
            <div key={p.ref} className={`grid gap-2 px-6 py-5 md:grid-cols-[120px_1fr_1.4fr] md:items-center ${i ? "border-t border-line" : ""}`}>
              <span className="font-mono text-[13px] text-fg">{p.ref}</span>
              <div>
                <p className="text-[14.5px] font-medium text-fg">{p.address}</p>
                <p className="text-[12.5px] text-sandbox">{p.status}</p>
              </div>
              <p className="text-[13.5px] text-muted">{p.detail}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            ["Accounts", "Everyday Checking ••4821, High-Yield Savings ••0937, Individual Brokerage ••2210, with a pending $40,000 transfer."],
            ["Closing", "Eleven lifecycle stages, 18 transaction documents and four recorded blockers: insurance binder, bank statements, HOA estoppel and a seller affidavit."],
            ["Ownership", "Obligations, escrow, Autopilot rules, warranties, renovations and six months of recurring bank activity."],
          ].map(([title, body]) => (
            <div key={title} className="rounded-lg border border-line bg-surface p-5">
              <p className="text-[14px] font-semibold text-fg">{title}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
