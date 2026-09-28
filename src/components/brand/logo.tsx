import { cn } from "@/lib/cn";
import { LOCKUP_PATH, LOCKUP_VIEWBOX, MARK_PATH, MARK_VIEWBOX } from "./logo-paths";

/** The official Sagolik MCP lockup, rendered as vector artwork in the current text colour. */
export function SagolikLockup({ className, title = "Sagolik MCP" }: { className?: string; title?: string }) {
  return (
    <svg viewBox={LOCKUP_VIEWBOX} className={cn("h-6 w-auto", className)} role="img" aria-label={title} fill="currentColor">
      <title>{title}</title>
      <path fillRule="evenodd" d={LOCKUP_PATH} />
    </svg>
  );
}

export function SagolikMark({ className, title = "Sagolik" }: { className?: string; title?: string }) {
  return (
    <svg viewBox={MARK_VIEWBOX} className={cn("h-6 w-auto", className)} role="img" aria-label={title} fill="currentColor">
      <title>{title}</title>
      <path fillRule="evenodd" d={MARK_PATH} />
    </svg>
  );
}
