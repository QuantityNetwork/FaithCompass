const STEPS = [
  { label: "Know", note: "Authorized data" },
  { label: "Analyze", note: "Structured insight" },
  { label: "Simulate", note: "No state change" },
  { label: "Prepare", note: "Drafts only" },
  { label: "Approve", note: "A human decides" },
  { label: "Execute", note: "Exact authority" },
  { label: "Audit", note: "Immutable record" },
];

export function OperatingModel() {
  return (
    <ol className="grid grid-cols-2 overflow-hidden rounded-xl border border-line sm:grid-cols-4 lg:grid-cols-7">
      {STEPS.map((step, i) => (
        <li key={step.label} className={`relative border-line bg-canvas px-4 py-5 ${i > 0 ? "lg:border-l" : ""} border-b lg:border-b-0`}>
          <span className="tnum font-mono text-[11px] text-subtle">{String(i + 1).padStart(2, "0")}</span>
          <p className={`mt-2 text-[15px] font-semibold tracking-tight ${step.label === "Approve" ? "text-prepare" : "text-fg"}`}>{step.label}</p>
          <p className="mt-0.5 text-[12.5px] text-muted">{step.note}</p>
        </li>
      ))}
    </ol>
  );
}
