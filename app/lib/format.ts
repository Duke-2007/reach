import type { Ci } from "@/types/data-contract";

export function roundToWhole(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value);
}

export function formatPercent(
  value: number | null | undefined,
  opts: { digits?: number; fallback?: string } = {},
): string {
  const digits = opts.digits ?? 0;
  const fallback = opts.fallback ?? "—";
  if (value == null || !Number.isFinite(value)) return fallback;
  const pct = value * 100;
  const rounded =
    digits === 0 ? Math.round(pct) : Number(pct.toFixed(digits));
  return `${rounded}%`;
}

export function formatCi(
  ci: Ci | null | undefined,
  opts: { digits?: number; fallback?: string; wrap?: boolean } = {},
): string {
  const digits = opts.digits ?? 0;
  const fallback = opts.fallback ?? "";
  const wrap = opts.wrap ?? true;
  if (!Array.isArray(ci) || ci.length !== 2) return fallback;
  const [lo, hi] = ci;
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return fallback;
  const loPct =
    digits === 0 ? Math.round(lo * 100) : Number((lo * 100).toFixed(digits));
  const hiPct =
    digits === 0 ? Math.round(hi * 100) : Number((hi * 100).toFixed(digits));
  const inner = `${loPct}–${hiPct}`;
  return wrap ? `(${inner})` : inner;
}

export function formatPercentWithCi(
  value: number | null | undefined,
  ci: Ci | null | undefined,
  opts: { digits?: number; smallCell?: boolean; smallCellText?: string } = {},
): string {
  if (opts.smallCell) return opts.smallCellText ?? "Suppressed (small cell)";
  const pct = formatPercent(value, { digits: opts.digits });
  const ciStr = formatCi(ci, { digits: opts.digits });
  return ciStr ? `${pct} ${ciStr}` : pct;
}

export function formatCount(
  value: number | null | undefined,
  opts: { smallCell?: boolean; smallCellText?: string } = {},
): string {
  if (opts.smallCell) return opts.smallCellText ?? "Suppressed (small cell)";
  if (value == null || !Number.isFinite(value)) return "—";
  return Math.round(value).toLocaleString("en-RW");
}

export function formatRwf(
  value: number | null | undefined,
  opts: { kind?: "per" | "millions"; fallback?: string } = {},
): string {
  const fallback = opts.fallback ?? "—";
  if (value == null || !Number.isFinite(value)) return fallback;
  const kind = opts.kind ?? "per";
  if (kind === "millions") {
    const m = value / 1_000_000;
    const rounded = Math.abs(m) >= 100 ? Math.round(m) : Number(m.toFixed(1));
    return `${rounded.toLocaleString("en-RW")} M RWF`;
  }
  return `${Math.round(value).toLocaleString("en-RW")} RWF / household`;
}
