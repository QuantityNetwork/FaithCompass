import type { Environment } from "@/domain/environments";

export function EnvironmentBand({ environment, demo }: { environment: Environment; demo: boolean }) {
  if (environment === "production" && !demo) return null;
  return (
    <div className={environment === "sandbox" ? "border-b border-sandbox/20 bg-sandbox-soft" : "border-b border-line bg-surface-2"}>
      <div className="flex h-8 items-center justify-center gap-2 px-4 text-[12px]">
        {environment === "sandbox" ? (
          <>
            <span className="h-1.5 w-1.5 rounded-full bg-sandbox" aria-hidden />
            <span className="font-semibold text-sandbox">Sandbox</span>
            <span className="text-sandbox/80">Synthetic data and simulated providers. No production records are affected.</span>
          </>
        ) : (
          <>
            <span className="font-semibold text-fg">Demo mode</span>
            <span className="text-muted">No database is configured, so production has no data. Configure Supabase to operate on live records.</span>
          </>
        )}
      </div>
    </div>
  );
}
