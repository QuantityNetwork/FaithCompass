/**
 * Structured JSON logger. Secrets are redacted by key name; values that look
 * like Sagolik tokens are masked. Logs never include tool arguments verbatim.
 */
type Level = "debug" | "info" | "warn" | "error";

const SENSITIVE = /(token|secret|password|authorization|api[_-]?key|credential|code_verifier)/i;
const TOKEN_PATTERN = /sgk_(test|live)_[a-z]{2}_[A-Za-z0-9]+/g;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 5) return "[depth]";
  if (typeof value === "string") return value.replace(TOKEN_PATTERN, "sgk_[redacted]");
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value && typeof value === "object") {
    if (value instanceof Error) return { name: value.name, message: redact(value.message, depth + 1) };
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, SENSITIVE.test(k) ? "[redacted]" : redact(v, depth + 1)]));
  }
  return value;
}

export interface Logger {
  debug(message: string, fields?: Record<string, unknown>): void;
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
}

function emit(level: Level, message: string, fields?: Record<string, unknown>) {
  if (process.env.NODE_ENV === "test" && level !== "error") return;
  const line = JSON.stringify({ level, time: new Date().toISOString(), service: "sagolik-mcp", message, ...(redact(fields ?? {}) as object) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger: Logger = {
  debug: (m, f) => emit("debug", m, f),
  info: (m, f) => emit("info", m, f),
  warn: (m, f) => emit("warn", m, f),
  error: (m, f) => emit("error", m, f),
};
