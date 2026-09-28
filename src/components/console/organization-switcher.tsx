"use client";

import { useTransition } from "react";
import { setOrganizationAction } from "@/app/(console)/actions";

export function OrganizationSwitcher({ current, options }: { current: string; options: { organizationId: string; name: string }[] }) {
  const [pending, start] = useTransition();
  if (options.length <= 1) return <p className="truncate text-[13px] font-medium text-fg">{options[0]?.name}</p>;
  return (
    <select
      aria-label="Organization"
      value={current}
      disabled={pending}
      onChange={(e) => start(() => setOrganizationAction(e.target.value))}
      className="w-full truncate rounded-md border border-line bg-canvas px-2 py-1 text-[13px] font-medium text-fg"
    >
      {options.map((o) => (
        <option key={o.organizationId} value={o.organizationId}>
          {o.name}
        </option>
      ))}
    </select>
  );
}
