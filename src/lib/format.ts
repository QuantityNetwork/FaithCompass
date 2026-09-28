const dateTime = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" });
const dateOnly = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export function formatDateTime(iso: string | null | undefined): string {
  return iso ? dateTime.format(new Date(iso)) : "—";
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return dateOnly.format(new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso));
}

export function relativeTime(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return "Never";
  const diff = (new Date(iso).getTime() - now.getTime()) / 1000;
  const abs = Math.abs(diff);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, seconds] of units) if (abs >= seconds) return rtf.format(Math.round(diff / seconds), unit);
  return abs < 45 ? (diff <= 0 ? "just now" : "in a moment") : rtf.format(Math.round(diff / 60), "minute");
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

export function titleCase(value: string): string {
  return value.replaceAll("_", " ").replace(/^\w/, (c) => c.toUpperCase());
}

export function formatMs(ms: number | null | undefined): string {
  if (ms == null) return "—";
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}
