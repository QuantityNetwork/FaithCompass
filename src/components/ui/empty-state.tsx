import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function EmptyState({ title, description, action, className, icon }: { title: string; description: ReactNode; action?: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      {icon && <div className="mb-4 text-subtle">{icon}</div>}
      <p className="text-[15px] font-semibold text-fg">{title}</p>
      <p className="mt-1.5 max-w-md text-[13.5px] leading-relaxed text-muted">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
