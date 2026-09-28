import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function KeyValue({ items, className, columns = 1 }: { items: { label: string; value: ReactNode }[]; className?: string; columns?: 1 | 2 | 3 }) {
  return (
    <dl className={cn("grid gap-x-8 gap-y-3", columns === 2 && "sm:grid-cols-2", columns === 3 && "sm:grid-cols-3", className)}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-[12px] text-muted">{item.label}</dt>
          <dd className="mt-0.5 truncate text-[13.5px] text-fg">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
