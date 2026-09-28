import type { Environment } from "@/domain/environments";
import { ENVIRONMENT_META } from "@/domain/environments";
import { randomBase62, sha256Hex } from "@/server/crypto/hash";

/** at = OAuth access token, rt = OAuth refresh token, ct = connection token (header auth). */
export type TokenKind = "at" | "rt" | "ct";

const TOKEN_PATTERN = /^sgk_(test|live)_(at|rt|ct)_[A-Za-z0-9]{40}$/;

export interface MintedToken {
  token: string;
  hash: string;
  /** Non-secret display prefix, e.g. "sgk_test_ct_4fQ9". */
  prefix: string;
}

export function mintToken(kind: TokenKind, environment: Environment): MintedToken {
  const token = `sgk_${ENVIRONMENT_META[environment].tokenPrefix}_${kind}_${randomBase62(40)}`;
  return { token, hash: hashToken(token), prefix: token.slice(0, 16) };
}

export function hashToken(token: string): string {
  return sha256Hex(token);
}

export function parseToken(token: string): { environment: Environment; kind: TokenKind } | null {
  const match = TOKEN_PATTERN.exec(token);
  if (!match) return null;
  return { environment: match[1] === "test" ? "sandbox" : "production", kind: match[2] as TokenKind };
}
