/**
 * Structured security events.
 *
 * One JSON line per write attempt, so the host's log drain can alert on it.
 * The client address is hashed and request text is never logged: an audit
 * trail must not become a store of what people asked.
 */
import { createHash, randomUUID } from 'node:crypto';

export interface SecurityEvent {
  action: string;
  outcome: 'allowed' | 'denied' | 'error';
  status: number;
  reason?: string;
  actorRole: string;
  actorId: string | null;
  client: string;
  requestId?: string;
  entityId?: string;
}

type Sink = (line: string) => void;
let sink: Sink = (line) => console.info(line);

export function setSecurityEventSink(s: Sink | null): void {
  sink = s ?? ((line) => console.info(line));
}

export function hashClient(raw: string): string {
  return createHash('sha256').update(`am:${raw}`).digest('hex').slice(0, 16);
}

export function newRequestId(): string {
  return randomUUID();
}

export function securityEvent(evt: SecurityEvent): void {
  sink(JSON.stringify({ type: 'security', at: new Date().toISOString(), ...evt }));
}

/**
 * Log a server error without its message.
 *
 * Error messages can carry request content (a parser quoting its input, a
 * provider echoing a prompt), so only the error's class and its code
 * locations are written. The full error never reaches the host's logs.
 */
export function logServerError(scope: string, err: unknown): void {
  const name = err instanceof Error ? err.name : typeof err;
  const frames =
    err instanceof Error && typeof err.stack === 'string'
      ? err.stack
          .split('\n')
          .filter((l) => /^\s+at /.test(l))
          .slice(0, 5)
          .map((l) => l.trim())
      : [];
  errorSink(JSON.stringify({ type: 'error', at: new Date().toISOString(), scope, name, frames }));
}

let errorSink: Sink = (line) => console.error(line);
export function setErrorSink(s: Sink | null): void {
  errorSink = s ?? ((line) => console.error(line));
}
