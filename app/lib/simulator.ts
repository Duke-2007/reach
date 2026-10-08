import type {
  AtObservedCoverage,
  Ci,
  RuleCode,
  SimulatorGrid,
  SimulatorRecord,
  SimulatorRecordA,
} from "@/types/data-contract";

const EPS = 1e-6;

export function normalizeBudgetPct(budgetPct: number): number {
  const n = Number(budgetPct);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(50, Math.round(n)));
}

export function budgetPctToShare(budgetPct: number): number {
  return normalizeBudgetPct(budgetPct) / 100;
}

export function lookupRecord(
  grid: SimulatorGrid,
  area: string,
  rule: RuleCode,
  budgetPct: number,
): SimulatorRecord | null {
  if (!grid || !Array.isArray(grid.records) || grid.records.length === 0) {
    return null;
  }
  const areaKey = String(area);
  if (rule === "A") {
    for (const r of grid.records) {
      if (r.area === areaKey && r.rule === "A") return r;
    }
    return null;
  }
  const share = budgetPctToShare(budgetPct);
  for (const r of grid.records) {
    if (
      r.area === areaKey &&
      r.rule === rule &&
      Math.abs((r as SimulatorRecord).budget_share - share) < EPS
    ) {
      return r;
    }
  }
  return null;
}

export function getAreaRuleARecord(
  grid: SimulatorGrid,
  area: string,
): SimulatorRecordA | null {
  const r = lookupRecord(grid, area, "A", 1);
  if (!r || r.rule !== "A") return null;
  return r;
}

export function getAtObservedCoverage(
  grid: SimulatorGrid,
  area: string,
  rule: "B" | "C",
): AtObservedCoverage | null {
  if (!grid || !Array.isArray(grid.at_observed_coverage)) return null;
  const areaKey = String(area);
  for (const a of grid.at_observed_coverage) {
    if (a.area === areaKey && a.rule === rule) return a;
  }
  return null;
}

export function formatNumber(
  value: number | null | undefined,
  digits: number,
  fallback: string,
): string {
  if (value == null || !Number.isFinite(value)) return fallback;
  const mult = Math.pow(10, digits);
  const rounded = Math.round(Number(value) * mult) / mult;
  return rounded.toFixed(digits);
}

export function formatCiForDisplay(
  ci: Ci | undefined | null,
  asPct: boolean,
  digits: number,
): string {
  if (!Array.isArray(ci) || ci.length !== 2) return "";
  const [lo, hi] = ci;
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return "";
  const mult = asPct ? 100 : 1;
  const fmt = (v: number) => {
    const m = Math.pow(10, digits);
    return (Math.round(v * mult * m) / m).toFixed(digits);
  };
  return `(${fmt(lo)}${asPct ? "%" : ""}–${fmt(hi)}${asPct ? "%" : ""})`;
}

export function buildScenarioCsvRows(
  grid: SimulatorGrid,
  area: string,
  rule: RuleCode,
  budgetPct: number,
  labels: {
    setting: string;
    value: string;
    rowArea: string;
    rowRule: string;
    rowRuleLabel: string;
    rowBudget: string;
    rowPoor: string;
    rowPoorLo: string;
    rowPoorHi: string;
    rowExtreme: string;
    rowExclusion: string;
    rowLeakage: string;
    rowCost: string;
    rowActual: string;
    ruleLabel?: string;
  },
): string {
  const rec = lookupRecord(grid, area, rule, budgetPct);
  const ruleLabel =
    labels.ruleLabel ?? grid.rules?.find((r) => r.code === rule)?.label ?? String(rule);
  const actualCoverage = rec?.rule === "A" ? rec.actual_coverage : null;
  const poorCi = rec?.poor_reached_ci ?? null;
  const rows: Array<[string, string]> = [
    [labels.rowArea, area],
    [labels.rowRule, rule],
    [labels.rowRuleLabel, ruleLabel],
    [labels.rowBudget, `${(rec?.budget_share ?? budgetPctToShare(budgetPct)).toFixed(4)}`],
    [labels.rowPoor, rec?.poor_reached != null ? rec.poor_reached.toFixed(6) : ""],
    [labels.rowPoorLo, poorCi ? poorCi[0].toFixed(6) : ""],
    [labels.rowPoorHi, poorCi ? poorCi[1].toFixed(6) : ""],
    [
      labels.rowExtreme,
      rec?.extreme_poor_reached != null ? rec.extreme_poor_reached.toFixed(6) : "",
    ],
    [
      labels.rowExclusion,
      rec?.exclusion_error != null ? rec.exclusion_error.toFixed(6) : "",
    ],
    [labels.rowLeakage, rec?.leakage != null ? rec.leakage.toFixed(6) : ""],
    [
      labels.rowCost,
      rec?.cost_per_poor_reached != null ? rec.cost_per_poor_reached.toFixed(4) : "",
    ],
  ];
  if (actualCoverage != null) {
    rows.push([labels.rowActual, actualCoverage.toFixed(6)]);
  }
  const esc = (v: string) => {
    const s = String(v ?? "");
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const header = `${esc(labels.setting)},${esc(labels.value)}\n`;
  const body = rows.map(([k, v]) => `${esc(k)},${esc(v)}`).join("\n");
  return header + body + "\n";
}

export function downloadCsv(filename: string, csv: string): void {
  const bom = "\uFEFF";
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
