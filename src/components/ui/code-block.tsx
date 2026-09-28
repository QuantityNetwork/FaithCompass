import { cn } from "@/lib/cn";
import { CopyButton } from "./copy-button";

export function CodeBlock({ code, language, title, className, copy = true, tone = "light" }: { code: string; language?: string; title?: string; className?: string; copy?: boolean; tone?: "light" | "dark" }) {
  const dark = tone === "dark";
  return (
    <div className={cn("overflow-hidden rounded-lg border", dark ? "border-[#0f2a4d] bg-[#071427]" : "border-line bg-surface", className)}>
      {(title || copy) && (
        <div className={cn("flex items-center justify-between gap-3 border-b px-4 py-2", dark ? "border-white/10" : "border-line")}>
          <span className={cn("font-mono text-[11.5px]", dark ? "text-white/55" : "text-muted")}>{title ?? language ?? ""}</span>
          {copy && <CopyButton value={code} className={dark ? "border-white/15 text-white/70 hover:bg-white/10 hover:text-white" : ""} />}
        </div>
      )}
      <pre className={cn("overflow-x-auto px-4 py-3.5 text-[12.5px] leading-[1.65]", dark ? "text-[#dbe6f5]" : "text-fg")}>
        <code>{code}</code>
      </pre>
    </div>
  );
}
