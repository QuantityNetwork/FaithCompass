"use client";

import { useState, useTransition } from "react";
import { decideApprovalAction } from "@/app/(console)/approvals/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";

export function DecisionForm({ approvalId, clientName, toolName }: { approvalId: string; clientName: string; toolName: string }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  const decide = (decision: "approve" | "deny") =>
    start(async () => {
      setError(null);
      const res = await decideApprovalAction({ approvalId, decision, note });
      if (!res.ok) setError(res.error ?? "The decision could not be recorded.");
      setConfirming(false);
    });

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="note" className="mb-1.5 block text-[12.5px] font-medium text-fg">
          Note <span className="font-normal text-subtle">(optional, recorded with the decision)</span>
        </label>
        <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className="min-h-20" />
      </div>
      {confirming ? (
        <div className="rounded-md border border-execute/25 bg-execute-soft px-4 py-3.5">
          <p className="text-[13px] text-fg">
            Approve this request? {clientName} will then be able to call <code className="font-mono text-[12px]">{toolName}</code> once, with exactly these arguments, before the approval expires.
          </p>
          <div className="mt-3 flex gap-2">
            <Button onClick={() => decide("approve")} disabled={pending}>
              {pending ? "Recording…" : "Confirm approval"}
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button onClick={() => setConfirming(true)} disabled={pending}>
            Approve
          </Button>
          <Button variant="danger" onClick={() => decide("deny")} disabled={pending}>
            Reject
          </Button>
        </div>
      )}
      {error && <p className="text-[13px] text-danger">{error}</p>}
    </div>
  );
}
