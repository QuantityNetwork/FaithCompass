import Link from "next/link";
import { SagolikLockup } from "@/components/brand/logo";

export function AuthShell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="flex h-16 items-center justify-center border-b border-line bg-canvas">
        <Link href="/" className="text-brand" aria-label="Sagolik MCP">
          <SagolikLockup className="h-[22px]" />
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-14">
        <div className={wide ? "w-full max-w-[640px]" : "w-full max-w-[400px]"}>{children}</div>
      </main>
      <footer className="pb-8 text-center text-[12px] text-subtle">From Decision to Ownership.</footer>
    </div>
  );
}
