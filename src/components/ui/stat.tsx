import type { ReactNode } from "react";

export function Stat({ label, value, detail }: { label: string; value: ReactNode; detail?: ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-canvas px-4 py-4 sm:px-5">
      <p className="text-[12.5px] text-muted">{label}</p>
      <p className="tnum mt-2 text-[28px] font-semibold leading-none tracking-[-0.02em] text-fg">{value}</p>
      {detail && <p className="mt-2 text-[12.5px] text-subtle">{detail}</p>}
    </div>
  );
}
