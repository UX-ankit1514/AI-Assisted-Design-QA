const dateTime = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const dateOnly = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** "22 Oct 2026, 18:20" — unambiguous, per the DS copy rules. */
export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}

export function formatDate(iso: string): string {
  return dateOnly.format(new Date(iso));
}

/** Difference percentage: never rounds a real difference down to "0%". */
export function formatPercent(value: number): string {
  if (value === 0) return "0%";
  if (value < 0.01) return "<0.01%";
  if (value < 10) return `${value.toFixed(2)}%`;
  return `${value.toFixed(1)}%`;
}

export function formatRegionShort(r: { x: number; y: number; width: number; height: number }): string {
  return `x ${r.x} · y ${r.y} · ${r.width} × ${r.height}`;
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}
