"use client";

import { useActionState, useState } from "react";
import { signInAction, type AuthState } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { cn } from "@/lib/cn";

export function LoginForm({ next }: { next: string }) {
  const [mode, setMode] = useState<"password" | "signup" | "magic">("password");
  const [state, action, pending] = useActionState<AuthState, FormData>(signInAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="next" value={next} />
      <div className="grid grid-cols-3 rounded-lg bg-surface-2 p-0.5">
        {(["password", "signup", "magic"] as const).map((m) => (
          <button key={m} type="button" onClick={() => setMode(m)} className={cn("h-8 rounded-md text-[12.5px] font-medium", mode === m ? "bg-canvas text-fg shadow-[0_1px_2px_rgb(10_22_40/0.08)]" : "text-muted")}>
            {m === "password" ? "Sign in" : m === "signup" ? "Create account" : "Email link"}
          </button>
        ))}
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      {mode !== "magic" && (
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={mode === "signup" ? 12 : undefined} required />
          {mode === "signup" && <p className="mt-1 text-[12px] text-subtle">At least 12 characters.</p>}
        </div>
      )}
      {state?.error && <p className="text-[13px] text-danger">{state.error}</p>}
      {state?.message && <p className="text-[13px] text-success">{state.message}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Please wait…" : mode === "password" ? "Sign in" : mode === "signup" ? "Create account" : "Send sign-in link"}
      </Button>
    </form>
  );
}
