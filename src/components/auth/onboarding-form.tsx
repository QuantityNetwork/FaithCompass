"use client";

import { useActionState } from "react";
import { createOrganizationAction } from "@/app/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";

const KINDS = [
  ["individual", "Individual"],
  ["family", "Family"],
  ["business", "Business"],
  ["wealth_structure", "Wealth structure"],
  ["professional", "Professional operator"],
  ["institution", "Institution"],
] as const;

export function OnboardingForm() {
  const [state, action, pending] = useActionState(createOrganizationAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <div>
        <Label htmlFor="name">Organization name</Label>
        <Input id="name" name="name" required maxLength={120} placeholder="e.g. Lindqvist Family Office" />
      </div>
      <div>
        <Label htmlFor="kind">Type</Label>
        <Select id="kind" name="kind" defaultValue="individual">
          {KINDS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      </div>
      {state?.error && <p className="text-[13px] text-danger">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creating…" : "Create organization"}
      </Button>
      <p className="text-[12px] text-subtle">You become the owner. A private sandbox with synthetic data is created for you.</p>
    </form>
  );
}
