import type { ClientType } from "@/domain/clients";
import type { MemberRole, OrganizationKind } from "@/domain/entities";
import type { Environment } from "@/domain/environments";
import type { ExecutionClass } from "@/domain/execution-classes";
import type { Scope } from "@/domain/scopes";

/**
 * A fully authenticated caller. Built only by the auth layer (bearer token →
 * session → connection → membership, or console session → membership).
 * Every field is derived server-side; nothing comes from the request body.
 */
export interface Caller {
  source: "mcp" | "console";
  organizationId: string;
  organization: { name: string; kind: OrganizationKind };
  environment: Environment;
  userId: string;
  role: MemberRole;
  client: { name: string; type: ClientType | "console"; connectionId: string | null; clientId: string | null };
  sessionId: string | null;
  scopes: Scope[];
  maxExecutionClass: ExecutionClass;
  transactionLimitCents: number | null;
  sessionExpiresAt: string | null;
  ip: string | null;
  userAgent: string | null;
}

/** Stable key identifying the requester for rate limits, idempotency and approvals. */
export function requesterKey(caller: Caller): string {
  return caller.client.connectionId ? `connection:${caller.client.connectionId}` : `console:${caller.userId}`;
}
