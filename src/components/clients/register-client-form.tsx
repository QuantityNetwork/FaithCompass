"use client";

import { useState, useTransition } from "react";
import { registerConfidentialClientAction } from "@/app/(console)/clients/actions";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/ui/code-block";
import { Input, Label, Textarea } from "@/components/ui/field";

export function RegisterClientForm({ disabled }: { disabled?: boolean }) {
  const [name, setName] = useState("");
  const [uris, setUris] = useState("");
  const [result, setResult] = useState<{ clientId: string; clientSecret: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (result) {
    return (
      <div className="space-y-3">
        <p className="rounded-md border border-warning/25 bg-warning-soft px-4 py-3 text-[13px] text-warning">Store the client secret now. Sagolik keeps only its hash.</p>
        <CodeBlock title="client_id" code={result.clientId} />
        <CodeBlock title="client_secret" code={result.clientSecret} />
        <Button variant="secondary" onClick={() => setResult(null)}>
          Done
        </Button>
      </div>
    );
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setError(null);
          const res = await registerConfidentialClientAction({ name, redirectUris: uris });
          if (res.ok) setResult({ clientId: res.clientId, clientSecret: res.clientSecret });
          else setError(res.error);
        });
      }}
    >
      <div>
        <Label htmlFor="client-name">Client name</Label>
        <Input id="client-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme treasury agent" required disabled={disabled} />
      </div>
      <div>
        <Label htmlFor="client-uris" hint="One per line · HTTPS or loopback">
          Redirect URIs
        </Label>
        <Textarea id="client-uris" value={uris} onChange={(e) => setUris(e.target.value)} placeholder="https://agent.example.com/oauth/callback" required disabled={disabled} className="min-h-16 font-mono text-[12.5px]" />
      </div>
      {error && <p className="text-[13px] text-danger">{error}</p>}
      <div>
        <Button type="submit" disabled={disabled || pending || !name || !uris}>
          {pending ? "Registering…" : "Register confidential client"}
        </Button>
      </div>
    </form>
  );
}
