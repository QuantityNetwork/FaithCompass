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
    <ol className="grid overflow-hidden rounded-xl border border-line md:grid-cols-7">
      {STEPS.map((step, i) => (
        <li
          key={step.label}
          className={`flex items-baseline gap-3 border-line bg-canvas px-4 py-3.5 md:block md:py-5 ${i > 0 ? "border-t md:border-l md:border-t-0" : ""}`}
        >
          <span className="tnum font-mono text-[11px] text-subtle">{String(i + 1).padStart(2, "0")}</span>
          <p className={`text-[15px] font-semibold tracking-tight md:mt-2 ${step.label === "Approve" ? "text-prepare" : "text-fg"}`}>{step.label}</p>
          <p className="ml-auto text-[12.5px] text-muted md:ml-0 md:mt-0.5">{step.note}</p>
        </li>
      ))}
    </ol>
  );
}
