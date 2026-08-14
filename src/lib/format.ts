/** Format bytes into a human readable string, e.g. 4.5 GiB */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || Number.isNaN(bytes) || bytes < 0) return "-";
  if (bytes === 0) return "0 B";
  const units = ["B", "KiB", "MiB", "GiB", "TiB", "PiB"];
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exp);
  return `${value >= 100 ? Math.round(value) : value.toFixed(value >= 10 ? 1 : 2)} ${units[exp]}`;
}

/** Format bytes per second, e.g. 12.3 MiB/s */
export function formatSpeed(bytesPerSecond: number | null | undefined): string {
  if (bytesPerSecond == null || bytesPerSecond <= 0) return "-";
  return `${formatBytes(bytesPerSecond)}/s`;
}

const SIZE_UNITS: Record<string, number> = {
  b: 1,
  kb: 1000,
  mb: 1000 * 1000,
  gb: 1000 * 1000 * 1000,
  tb: 1000 * 1000 * 1000 * 1000,
  kib: 1024,
  mib: 1024 * 1024,
  gib: 1024 * 1024 * 1024,
  tib: 1024 * 1024 * 1024 * 1024,
};

/** Parse a size string like "4.5 GiB" or "450MB" into bytes. Returns null when unparseable. */
export function parseSizeToBytes(input: string | number | null | undefined): number | null {
  if (input == null) return null;
  if (typeof input === "number") return Number.isFinite(input) ? Math.round(input) : null;
  const match = /([\d.,]+)\s*(b|kb|mb|gb|tb|kib|mib|gib|tib)?/i.exec(input.trim());
  if (!match) return null;
  const value = parseFloat(match[1].replace(/,/g, ""));
  if (!Number.isFinite(value) || value < 0) return null;
  const unit = SIZE_UNITS[(match[2] ?? "b").toLowerCase()] ?? 1;
  return Math.round(value * unit);
}

/** Short date-time formatter, locale aware */
export function formatDateTime(date: Date | null | undefined, locale: string): string {
  if (!date) return "-";
  try {
    return new Intl.DateTimeFormat(locale === "zh-CN" ? "zh-CN" : locale, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

export function formatPercent(fraction: number | null | undefined): string {
  if (fraction == null) return "-";
  return `${(Math.min(Math.max(fraction, 0), 1) * 100).toFixed(1)}%`;
}
