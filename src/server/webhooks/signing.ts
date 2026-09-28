import { hmacSha256Hex, safeEqual } from "@/server/crypto/hash";

export const SIGNATURE_HEADER = "Sagolik-Signature";
export const SIGNATURE_TOLERANCE_SECONDS = 300;

/**
 * Signature header: `t=<unix seconds>,v1=<hex hmac>[,v1=<hex hmac>]`.
 * The HMAC-SHA256 covers `${t}.${rawBody}`. During secret rotation both the
 * new and the previous secret sign, so receivers can roll over without gaps.
 */
export function signPayload(secrets: string[], timestamp: number, body: string): string {
  const parts = [`t=${timestamp}`, ...secrets.map((s) => `v1=${hmacSha256Hex(s, `${timestamp}.${body}`)}`)];
  return parts.join(",");
}

export function verifySignature(header: string, body: string, secret: string, nowSeconds: number, tolerance = SIGNATURE_TOLERANCE_SECONDS): boolean {
  const fields = header.split(",").map((p) => p.trim().split("="));
  const t = Number(fields.find(([k]) => k === "t")?.[1]);
  if (!Number.isFinite(t) || Math.abs(nowSeconds - t) > tolerance) return false;
  const expected = hmacSha256Hex(secret, `${t}.${body}`);
  return fields.some(([k, v]) => k === "v1" && typeof v === "string" && safeEqual(v, expected));
}
