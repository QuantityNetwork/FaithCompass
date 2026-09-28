import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

const control =
  "w-full rounded-md border border-line-strong bg-canvas px-3 text-[13.5px] text-fg placeholder:text-subtle transition-colors focus:border-focus focus:outline-none focus:ring-3 focus:ring-focus/15 disabled:bg-surface-2 disabled:text-muted";

export function Label({ children, htmlFor, hint }: { children: ReactNode; htmlFor?: string; hint?: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline justify-between gap-3 text-[12.5px] font-medium text-fg">
      <span>{children}</span>
      {hint && <span className="font-normal text-subtle">{hint}</span>}
    </label>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, "h-9", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-24 py-2 leading-relaxed", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select className={cn(control, "h-9 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 12 12%22><path d=%22M3 4.5l3 3 3-3%22 fill=%22none%22 stroke=%22%235f6b7a%22 stroke-width=%221.4%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22/></svg>')] bg-[position:right_10px_center] bg-no-repeat pr-8", className)} {...props}>
      {children}
    </select>
  );
}

export function Checkbox({ className, ...props }: ComponentProps<"input">) {
  return <input type="checkbox" className={cn("h-4 w-4 rounded-[4px] border-line-strong accent-brand", className)} {...props} />;
}

export function FieldRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid gap-1", className)}>{children}</div>;
}
