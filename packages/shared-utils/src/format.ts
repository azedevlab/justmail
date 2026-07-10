/** Human-friendly formatters. Small on purpose; heavier locale-aware work
 * routes through Intl to avoid a bundle-heavy formatter dependency. */

export function fmtBytes(n: number, decimals = 1): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(decimals)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(decimals)} MB`;
  if (n < 1024 ** 4) return `${(n / 1024 ** 3).toFixed(decimals)} GB`;
  return `${(n / 1024 ** 4).toFixed(decimals)} TB`;
}

export function fmtMb(mb: number): string {
  if (mb < 1024) return `${mb} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

export function fmtNumber(n: number, locale?: string): string {
  return new Intl.NumberFormat(locale ?? undefined).format(n);
}

export function fmtRelative(date: Date | string, now = new Date()): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const secs = Math.round((d.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(secs);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (abs < 60) return rtf.format(secs, "second");
  if (abs < 3600) return rtf.format(Math.round(secs / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(secs / 3600), "hour");
  if (abs < 2592000) return rtf.format(Math.round(secs / 86400), "day");
  if (abs < 31536000) return rtf.format(Math.round(secs / 2592000), "month");
  return rtf.format(Math.round(secs / 31536000), "year");
}

export function fmtDate(date: Date | string, locale?: string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(locale ?? undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function fmtTime(date: Date | string, locale?: string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString(locale ?? undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function truncate(s: string, max: number, tail = "…"): string {
  if (s.length <= max) return s;
  return s.slice(0, Math.max(0, max - tail.length)) + tail;
}
