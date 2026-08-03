const UNITS = ["B", "KB", "MB", "GB", "TB"];

export function formatBytes(bytes: number, digits = 1): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const i = Math.min(
    UNITS.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  const value = bytes / 1024 ** i;
  const rounded = i === 0 ? Math.round(value) : Number(value.toFixed(digits));
  return `${rounded} ${UNITS[i]}`;
}

export function formatEventDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(`${date}T00:00:00Z`) : date;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

export function formatDateTime(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function daysUntil(value: string | Date | null): number | null {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  const ms = d.getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

/** "in 6 months", "in 12 days", "today". Retention copy, so it stays plain. */
export function describeRetention(expiresAt: string | null): string {
  if (!expiresAt) return "Kept forever";
  const days = daysUntil(expiresAt);
  if (days === null) return "Kept forever";
  if (days < 0) return "Expired";
  if (days === 0) return "Expires today";
  if (days === 1) return "Expires tomorrow";
  if (days < 45) return `Expires in ${days} days`;
  const months = Math.round(days / 30);
  return `Expires in about ${months} months`;
}

export function formatEur(amount: number): string {
  return amount === 0 ? "€0" : `€${amount}`;
}

export function pluralise(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
