"use client";

import { useTransition } from "react";
import { revokeConnectionAction } from "@/app/(console)/connections/actions";
import { Button } from "@/components/ui/button";

export function RevokeButton({ connectionId, name, size = "sm" }: { connectionId: string; name: string; size?: "sm" | "md" }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="danger"
      size={size}
      disabled={pending}
      onClick={() => {
        if (!confirm(`Revoke ${name}? Its sessions stop working on the next request. This cannot be undone.`)) return;
        start(async () => {
          const res = await revokeConnectionAction(connectionId);
          if (!res.ok) alert(res.error);
        });
      }}
    >
      {pending ? "Revoking…" : "Revoke"}
    </Button>
  );
}
