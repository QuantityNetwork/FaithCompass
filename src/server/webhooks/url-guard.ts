import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Webhook destinations must be public HTTPS endpoints. Private, loopback,
 * link-local and metadata addresses are rejected to prevent server-side
 * request forgery, both when the endpoint is saved and at delivery time.
 */
function isPrivateIPv4(ip: string): boolean {
  const [a = 0, b = 0] = ip.split(".").map(Number);
  return (
    a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) || a >= 224
  );
}

function isPrivateIPv6(ip: string): boolean {
  const v = ip.toLowerCase();
  if (v === "::1" || v === "::") return true;
  if (v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80")) return true;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v);
  return mapped ? isPrivateIPv4(mapped[1]!) : false;
}

export function isPrivateAddress(ip: string): boolean {
  return isIP(ip) === 4 ? isPrivateIPv4(ip) : isIP(ip) === 6 ? isPrivateIPv6(ip) : true;
}

export type UrlCheck = { ok: true; url: URL } | { ok: false; reason: string };

export function validateWebhookUrl(raw: string): UrlCheck {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "Enter a valid URL." };
  }
  if (url.protocol !== "https:") return { ok: false, reason: "Webhook endpoints must use HTTPS." };
  if (url.username || url.password) return { ok: false, reason: "Credentials in the URL are not allowed." };
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return { ok: false, reason: "Private hostnames are not allowed." };
  }
  if (isIP(host) && isPrivateAddress(host)) return { ok: false, reason: "Private or reserved IP addresses are not allowed." };
  if (raw.length > 2048) return { ok: false, reason: "URL is too long." };
  return { ok: true, url };
}

/** Resolve the hostname and ensure every address is public. */
export async function assertPublicDestination(url: URL, resolver: typeof lookup = lookup): Promise<void> {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [{ address: host }] : await resolver(host, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) {
    throw new Error("Destination resolves to a private or reserved address.");
  }
}
