"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Scatter,
} from "recharts";
import { useT } from "@/hooks/useT";
import type {
  AtObservedCoverage,
  Ci,
  RuleCode,
  ScorecardPoint,
  SimulatorGrid,
  SimulatorRecord,
  SimulatorRecordA,
} from "@/types/data-contract";
import { formatCi } from "@/lib/format";
import {
  budgetPctToShare,
  buildScenarioCsvRows,
  downloadCsv,
  formatCiForDisplay,
  formatNumber,
  getAreaRuleARecord,
  getAtObservedCoverage,
  lookupRecord,
  normalizeBudgetPct,
} from "@/lib/simulator";

type BudgetPct = number;

function dashOr(v: string, nullText: string): string {
  if (v == null || v === "") return nullText;
  return v;
}

function getScorecardFeatureLabel(
  feature: string,
  t: (k: string) => string,
  nullText: string,
): string {
  const key = `scorecard_features.${feature}`;
  const tr = t(key);
  return tr === key || tr === `[${key}]` ? nullText : tr;
}

function getScorecardBandLabel(
  feature: string,
  band: string | null,
  description: string | null,
  t: (k: string) => string,
  nullText: string,
): string {
  if (band == null || description == null) return nullText;
  const key = `scorecard_bands.${feature}.${band}`;
  const translated = t(key);
  return translated === key || translated === `[${key}]`
    ? nullText
    : `${band} — ${translated}`;
}

function groupByFeature(points: ScorecardPoint[]): Record<string, ScorecardPoint[]> {
  const out: Record<string, ScorecardPoint[]> = {};
  for (const p of points) {
    if (!out[p.feature]) out[p.feature] = [];
    out[p.feature].push(p);
  }
  return out;
}

type ChartRow = {
  budget_share: number;
  budget_pct: number;
  ruleB: number | null;
  ruleB_ci: Ci | null;
  ruleC: number | null;
  ruleC_ci: Ci | null;
  random: number;
};

type TFn = (key: string, vals?: Record<string, string | number>) => string;

function ChartCustomTooltip({
  active,
  payload,
  label,
  t,
}: {
  active?: boolean;
  payload?: Array<{
    dataKey: string;
    value: number | string;
    payload?: ChartRow & { ruleA_x?: number; ruleA_y?: number };
    name?: string;
  }>;
  label?: number | string;
  t: TFn;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload as
    | (ChartRow & { ruleA_x?: number; ruleA_y?: number })
    | undefined;
  const budgetPctVal =
    row?.ruleA_x != null
      ? row.ruleA_x
      : row?.budget_pct != null
        ? row.budget_pct
        : typeof label === "number"
          ? label
          : null;
  const lines: Array<{
    color: string;
    name: string;
    value: string;
    extra?: string;
  }> = [];

  for (const p of payload) {
    if (!p || p.value == null) continue;
    let color = "#6366f1";
    if (p.dataKey === "ruleC_100") color = "#0d9488";
    if (p.dataKey === "random_100") color = "#94a3b8";
    if (p.dataKey === "ruleA") color = "#f59e0b";
    const dv = Number(p.value);
    const text = Number.isFinite(dv) ? `${dv.toFixed(1)}%` : String(p.value);
    let extra = "";
    if (row && p.dataKey === "ruleB_100" && row.ruleB_ci) {
      const [lo, hi] = row.ruleB_ci;
      if (Number.isFinite(lo) && Number.isFinite(hi)) {
        extra = ` ${formatCi([lo, hi], { digits: 1, wrap: true })}`;
      }
    }
    if (row && p.dataKey === "ruleC_100" && row.ruleC_ci) {
      const [lo, hi] = row.ruleC_ci;
      if (Number.isFinite(lo) && Number.isFinite(hi)) {
        extra = ` ${formatCi([lo, hi], { digits: 1, wrap: true })}`;
      }
    }
    lines.push({ color, name: p.name ?? String(p.dataKey), value: text, extra });
  }

  return (
    <div className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 shadow-lg dark:border-slate-700">
      {budgetPctVal != null ? (
        <p className="mb-1 font-semibold">
          {t("simulate.chart_tooltip_budget")}: {Number(budgetPctVal).toFixed(1)}%
        </p>
      ) : null}
      <ul className="space-y-0.5">
        {lines.map((ln, i) => (
          <li key={i} className="flex items-start gap-2">
            <span
              aria-hidden
              className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full"
              style={{ background: ln.color }}
            />
            <span className="min-w-0 break-words">
              <span className="font-medium">{ln.name}:</span>{" "}
              <span className="tabular-nums">{ln.value}</span>
              {ln.extra ? (
                <span className="ml-1 text-slate-400 tabular-nums">
                  {ln.extra}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChartRuleADot(props: { cx?: number; cy?: number }) {
  const { cx, cy } = props;
  if (cx == null || cy == null) return null;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={6}
      fill="#fff7ed"
      stroke="#d97706"
      strokeWidth={2}
    />
  );
}

export function SimulatePage({ data }: { data: SimulatorGrid }) {
  const { t } = useT();

  const defaultArea = useMemo(
    () => (data.areas?.includes("national") ? "national" : data.areas?.[0] ?? ""),
    [data],
  );
  const [selectedArea, setSelectedArea] = useState<string>(defaultArea);
  const [selectedRule, setSelectedRule] = useState<RuleCode>("B");
  const [budgetPct, setBudgetPct] = useState<BudgetPct>(10);

  const displayBudget = selectedRule === "A" ? -1 : normalizeBudgetPct(budgetPct);

  const activeRecord = useMemo<SimulatorRecord | null>(
    () => lookupRecord(data, selectedArea, selectedRule, budgetPct),
    [data, selectedArea, selectedRule, budgetPct],
  );

  const ruleARecord = useMemo<SimulatorRecordA | null>(
    () => getAreaRuleARecord(data, selectedArea),
    [data, selectedArea],
  );

  const nullText = t("simulate.null_value");

  const nullSafe = useCallback(
    (v: number | null | undefined, digits: number, asPct = false) => {
      if (v == null || !Number.isFinite(v)) return nullText;
      const mult = asPct ? 100 : 1;
      const m = Math.pow(10, digits);
      const rounded = Math.round(Number(v) * mult * m) / m;
      return `${rounded.toFixed(digits)}${asPct ? "%" : ""}`;
    },
    [nullText],
  );

  const nullSafeCost = useCallback(
    (v: number | null | undefined) => {
      if (v == null || !Number.isFinite(v)) return nullText;
      return t("simulate.result_cost_value", {
        value: formatNumber(v, 2, nullText),
      });
    },
    [nullText, t],
  );

  const ciSuffix = (ci: Ci | undefined | null, asPct = true) =>
    t("simulate.result_ci_suffix", {
      value: dashOr(formatCiForDisplay(ci, asPct, 1), nullText),
    });
  const exclusionCi = activeRecord?.poor_reached_ci
    ? ([1 - activeRecord.poor_reached_ci[1], 1 - activeRecord.poor_reached_ci[0]] as Ci)
    : null;

  // Build comparison lines data for B, C and rule A marker + random diagonal
  const { linesData, ruleAPoint, maxBudgetX } = useMemo(() => {
    const budgets = Array.from({ length: 50 }, (_, i) => (i + 1) / 100);
    const rows = budgets.map((s) => {
      const bRec = lookupRecord(data, selectedArea, "B", Math.round(s * 100));
      const cRec = lookupRecord(data, selectedArea, "C", Math.round(s * 100));
      return {
        budget_share: s,
        budget_pct: Math.round(s * 100),
        ruleB: bRec?.poor_reached ?? null,
        ruleB_ci: bRec?.poor_reached_ci ?? null,
        ruleC: cRec?.poor_reached ?? null,
        ruleC_ci: cRec?.poor_reached_ci ?? null,
        random: s, // random targeting = budget share
      };
    });
    let a: { budget_share: number; value: number } | null = null;
    if (
      ruleARecord &&
      ruleARecord.actual_coverage != null &&
      ruleARecord.poor_reached != null
    ) {
      a = {
        budget_share: ruleARecord.actual_coverage,
        value: ruleARecord.poor_reached,
      };
    }
    return { linesData: rows, ruleAPoint: a, maxBudgetX: 0.5 };
  }, [data, selectedArea, ruleARecord]);

  const selectedBudgetShare =
    selectedRule === "A" && ruleARecord
      ? ruleARecord.actual_coverage
      : budgetPctToShare(displayBudget);

  // at_observed_coverage callout entries
  const callouts = useMemo<{ rule: "B" | "C"; entry: AtObservedCoverage | null }[]>(
    () => [
      { rule: "B", entry: getAtObservedCoverage(data, selectedArea, "B") },
      { rule: "C", entry: getAtObservedCoverage(data, selectedArea, "C") },
    ],
    [data, selectedArea],
  );

  // Scorecard grouped by feature
  const scorecardByFeature = useMemo(
    () => groupByFeature(data.scorecard?.points ?? []),
    [data],
  );
  const scorecardFeaturesOrder = data.scorecard?.features ?? [];

  const handleDownload = useCallback(() => {
    const scenarioBudgetPct =
      selectedRule === "A" && ruleARecord
        ? Math.round(ruleARecord.actual_coverage * 1000) / 10
        : normalizeBudgetPct(budgetPct);
    const labels = {
      setting: t("simulate.download_header_setting"),
      value: t("simulate.download_header_value"),
      ruleLabel: t(`simulate.rule_${selectedRule}_title`),
      rowArea: t("simulate.download_row_area"),
      rowRule: t("simulate.download_row_rule"),
      rowRuleLabel: t("simulate.download_row_rule_label"),
      rowBudget: t("simulate.download_row_budget"),
      rowPoor: t("simulate.download_row_poor_reached"),
      rowPoorLo: t("simulate.download_row_poor_reached_lo"),
      rowPoorHi: t("simulate.download_row_poor_reached_hi"),
      rowExtreme: t("simulate.download_row_extreme_poor_reached"),
      rowExclusion: t("simulate.download_row_exclusion_error"),
      rowLeakage: t("simulate.download_row_leakage"),
      rowCost: t("simulate.download_row_cost_per_poor"),
      rowActual: t("simulate.download_row_actual_coverage"),
    };
    const csv = buildScenarioCsvRows(
      data,
      selectedArea,
      selectedRule,
      scenarioBudgetPct,
      labels,
    );
    const filename = t("simulate.download_filename", {
      area: selectedArea,
      rule: selectedRule,
      budget: String(scenarioBudgetPct),
    });
    downloadCsv(filename, csv);
  }, [
    data,
    selectedArea,
    selectedRule,
    ruleARecord,
    budgetPct,
    t,
  ]);

  const fmtPct = (v: number | null | undefined, digits = 1) =>
    nullSafe(v, digits, true);
  const fmtGain = (v: number | null | undefined) => {
    if (v == null || !Number.isFinite(v)) return nullText;
    return formatNumber(v, 1, nullText);
  };
  const fmtGainCi = (ci: Ci | undefined | null) => {
    if (!Array.isArray(ci) || ci.length !== 2) return nullText;
    const [lo, hi] = ci;
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return nullText;
    return `(${formatNumber(lo, 1, nullText)}–${formatNumber(hi, 1, nullText)})`;
  };

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 sm:py-14 min-w-0">
      <h1 className="mb-6 max-w-4xl text-2xl font-semibold leading-tight tracking-tight text-slate-950 dark:text-slate-50 sm:text-3xl">
        {t("pages.simulate_heading")}
      </h1>

      <section
        className="mb-6 grid grid-cols-1 gap-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:grid-cols-2 lg:grid-cols-4 min-w-0"
        aria-label={t("simulate.rule_label")}
      >
        <div className="min-w-0">
          <label
            htmlFor="simulate-area"
            className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400"
          >
            {t("simulate.area_label")}
          </label>
          <select
            id="simulate-area"
            value={selectedArea}
            onChange={(e) => setSelectedArea(e.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 min-w-0"
          >
            {(data.areas ?? []).map((a) => (
              <option key={a} value={a}>
                {a === "national" ? t("simulate.area_national") : a}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0 lg:col-span-2">
          <label
            htmlFor="simulate-budget"
            className="mb-1 flex items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-400"
          >
            <span>{t("simulate.budget_label")}</span>
            <span className="tabular-nums">
              {selectedRule === "A"
                ? ruleARecord
                  ? t("simulate.budget_value", {
                      value: (ruleARecord.actual_coverage * 100).toFixed(1),
                    })
                  : nullText
                : t("simulate.budget_value", { value: displayBudget })}
            </span>
          </label>
          <input
            id="simulate-budget"
            type="range"
            min={1}
            max={50}
            step={1}
            value={displayBudget === -1 ? 10 : displayBudget}
            disabled={selectedRule === "A"}
            onChange={(e) => setBudgetPct(Number(e.target.value))}
            className="w-full accent-indigo-700 dark:accent-indigo-400"
            aria-valuemin={1}
            aria-valuemax={50}
            aria-valuenow={selectedRule === "A" ? undefined : displayBudget}
            aria-disabled={selectedRule === "A"}
          />
        </div>

        <div className="min-w-0">
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
            {t("simulate.rule_label")}
          </label>
          <div
            role="radiogroup"
            aria-label={t("simulate.rule_label")}
            className="grid grid-cols-3 gap-1 rounded-md border border-slate-300 bg-white p-1 text-xs dark:border-slate-700 dark:bg-slate-950 min-w-0"
          >
            {(["A", "B", "C"] as RuleCode[]).map((rc) => (
              <button
                key={rc}
                type="button"
                role="radio"
                aria-checked={selectedRule === rc}
                onClick={() => setSelectedRule(rc)}
                className={
                  "rounded-[5px] px-2 py-1.5 text-center font-medium transition-colors " +
                  (selectedRule === rc
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                    : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800")
                }
              >
                {rc}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800 min-w-0 sm:col-span-2 lg:col-span-2">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {t(`simulate.rule_${selectedRule.toLowerCase()}_title`)}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            {t(`simulate.rule_${selectedRule.toLowerCase()}_desc`)}
          </p>
        </div>

        <div className="sm:col-span-2 lg:col-span-4">
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="h-4 w-4 shrink-0"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {t("simulate.download_label")}
          </button>
        </div>
      </section>

      <section
        className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 min-w-0"
        aria-label={t("simulate.results_aria")}
      >
        <ResultCard
          label={t("simulate.result_poor_reached")}
          value={fmtPct(activeRecord?.poor_reached, 1)}
          suffix={ciSuffix(activeRecord?.poor_reached_ci ?? null)}
        />
        <ResultCard
          label={t("simulate.result_extreme_poor_reached")}
          value={fmtPct(activeRecord?.extreme_poor_reached, 1)}
          suffix={ciSuffix(null)}
        />
        <ResultCard
          label={t("simulate.result_exclusion_error")}
          value={fmtPct(activeRecord?.exclusion_error, 1)}
          suffix={ciSuffix(exclusionCi)}
        />
        <ResultCard
          label={t("simulate.result_leakage")}
          value={fmtPct(activeRecord?.leakage, 1)}
          suffix={ciSuffix(null)}
        />
        <ResultCard
          label={t("simulate.result_cost")}
          value={nullSafeCost(activeRecord?.cost_per_poor_reached)}
          suffix={ciSuffix(null, false)}
          full
        />
      </section>

      <section className="mb-6 rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 min-w-0">
        <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
          {t("simulate.chart_title")}
        </h2>
        <ReachChart
          linesData={linesData}
          ruleAPoint={ruleAPoint}
          selectedBudgetX={selectedBudgetShare}
          maxX={maxBudgetX}
          t={t}
        />
      </section>

      <section className="mb-6 rounded-md border border-indigo-200 bg-indigo-50/60 p-4 shadow-sm dark:border-indigo-900/60 dark:bg-indigo-950/30 min-w-0">
        <h2 className="mb-2 text-sm font-semibold text-indigo-900 dark:text-indigo-200">
          {t("simulate.callout_title")}
        </h2>
        <p className="mb-3 text-xs text-indigo-900/80 dark:text-indigo-200/80">
          {t("simulate.callout_subtitle")}
        </p>
        <ul className="space-y-2">
          {callouts.map(({ rule, entry }) => {
            if (!entry) {
              return (
                <li
                  key={rule}
                  className="text-xs text-indigo-900/70 dark:text-indigo-200/70"
                >
                  {t(`simulate.rule_${rule}_short`)}: {nullText}
                </li>
              );
            }
            if (!entry.clear_gain) {
              return (
                <li
                  key={rule}
                  className="rounded-md border border-indigo-200/60 bg-white/60 p-3 text-xs dark:border-indigo-900/50 dark:bg-slate-900/40"
                >
                  <p className="font-semibold text-indigo-900 dark:text-indigo-200">
                    {t(`simulate.rule_${rule}_short`)}
                  </p>
                  <p className="mt-1 text-indigo-900/80 dark:text-indigo-200/80">
                    {t("simulate.callout_no_gain", { gain: fmtGain(entry.gain_per_1000_poor), ci: fmtGainCi(entry.gain_per_1000_poor_ci) })}
                  </p>
                </li>
              );
            }
            const gain = fmtGain(entry.gain_per_1000_poor);
            const ci = fmtGainCi(entry.gain_per_1000_poor_ci);
            return (
              <li
                key={rule}
                className="rounded-md border border-indigo-200/60 bg-white/70 p-3 text-xs dark:border-indigo-900/50 dark:bg-slate-900/40"
              >
                <p className="font-semibold text-indigo-900 dark:text-indigo-200">
                  {t(`simulate.rule_${rule}_short`)}
                </p>
                <p className="mt-1 text-indigo-900/90 dark:text-indigo-200/90">
                  {t(`simulate.callout_gain_no_rule${rule === "B" ? "B" : "C"}`, {
                    gain,
                    ci,
                  })}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 min-w-0">
        <h2 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          {t("simulate.scorecard_title")}
        </h2>
        <p className="mb-3 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
          {t("simulate.scorecard_note")}
        </p>
        <div className="min-w-0 max-w-full">
          <table className="w-full table-fixed border-collapse text-xs min-w-0">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="w-[28%] break-words px-2 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">
                  {t("simulate.scorecard_feature")}
                </th>
                <th className="w-[58%] break-words px-2 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">
                  {t("simulate.scorecard_description")}
                </th>
                <th className="w-[14%] break-words px-1 py-2 text-right font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                  {t("simulate.scorecard_points")}
                </th>
              </tr>
            </thead>
            <tbody>
              {scorecardFeaturesOrder.length === 0 &&
                (data.scorecard?.points ?? []).length === 0 && (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-2 py-4 text-center text-slate-500 dark:text-slate-500"
                    >
                      {nullText}
                    </td>
                  </tr>
                )}
              {scorecardFeaturesOrder.map((feat, idx) => {
                const rows = scorecardByFeature[feat] ?? [];
                if (rows.length === 0) return null;
                const featureLabel = getScorecardFeatureLabel(feat, t, nullText);
                return rows.map((pt, rowIdx) => (
                  <tr
                    key={`${feat}-${rowIdx}`}
                    className={
                      "border-b border-slate-100 last:border-b-0 dark:border-slate-800 " +
                      (idx % 2 === 0
                        ? "bg-white dark:bg-slate-900"
                        : "bg-slate-50 dark:bg-slate-950/40")
                    }
                  >
                    {rowIdx === 0 ? (
                      <td
                        className="break-words px-2 py-2 align-top font-medium text-slate-800 dark:text-slate-200"
                        rowSpan={rows.length}
                      >
                        {featureLabel}
                      </td>
                    ) : null}
                    <td className="break-words px-2 py-2 align-top text-slate-700 dark:text-slate-300">
                      {getScorecardBandLabel(feat, pt.band_or_code, pt.description, t, nullText)}
                    </td>
                    <td className="break-words px-1 py-2 align-top text-right tabular-nums text-slate-900 dark:text-slate-100">
                      {pt.points == null
                        ? nullText
                        : pt.points > 0
                          ? `+${pt.points}`
                          : String(pt.points)}
                    </td>
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ResultCard({
  label,
  value,
  suffix,
  full,
}: {
  label: string;
  value: string;
  suffix?: string;
  full?: boolean;
}) {
  return (
    <div
      className={
        "rounded-md border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900 min-w-0 " +
        (full ? "sm:col-span-2 lg:col-span-1" : "")
      }
    >
      <p className="text-xs font-medium text-slate-600 dark:text-slate-400 truncate">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100 break-words">
        {value}
        {suffix ? (
          <span className="ml-1 text-xs font-normal text-slate-500 dark:text-slate-500 whitespace-nowrap">
            {suffix}
          </span>
        ) : null}
      </p>
    </div>
  );
}


function ReachChart({
  linesData,
  ruleAPoint,
  selectedBudgetX,
  maxX,
  t,
}: {
  linesData: ChartRow[];
  ruleAPoint: { budget_share: number; value: number } | null;
  selectedBudgetX: number;
  maxX: number;
  t: TFn;
}) {
  const aScatter = ruleAPoint
    ? [
        {
          x: ruleAPoint.budget_share * 100,
          y: ruleAPoint.value * 100,
          ruleA_x: ruleAPoint.budget_share * 100,
          ruleA_y: ruleAPoint.value * 100,
        },
      ]
    : [];

  const selectedX = selectedBudgetX * 100;

  const xTicks = [0, 10, 20, 30, 40, 50];

  const chartData = linesData.map((r) => ({
    ...r,
    budget_pct_100: r.budget_pct,
    ruleB_100: r.ruleB == null ? null : r.ruleB * 100,
    ruleC_100: r.ruleC == null ? null : r.ruleC * 100,
    random_100: r.random * 100,
  }));

  return (
    <div
      className="w-full min-w-0 max-w-full"
      aria-label={t("simulate.chart_aria")}
      role="img"
    >
      <div className="h-[320px] w-full min-w-0 max-w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 8, right: 16, left: 0, bottom: 36 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="budget_pct_100"
              type="number"
              domain={[0, maxX * 100]}
              ticks={xTicks}
              tickFormatter={(v) => `${v}%`}
              stroke="#64748b"
              fontSize={11}
              label={{
                value: t("simulate.chart_xaxis"),
                position: "insideBottom",
                offset: -16,
                style: { fill: "#64748b", fontSize: 11 },
              }}
            />
            <YAxis
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              stroke="#64748b"
              fontSize={11}
              label={{
                value: t("simulate.chart_yaxis"),
                angle: -90,
                position: "insideLeft",
                offset: 4,
                style: { fill: "#64748b", fontSize: 11, textAnchor: "middle" },
              }}
            />
            <Tooltip
              content={
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (props: any) => (
                  <ChartCustomTooltip {...props} t={t} />
                )
              }
              cursor={{ stroke: "#cbd5e1", strokeDasharray: "3 3" }}
            />
            <ReferenceLine
              x={selectedX}
              stroke="#3f3fbf"
              strokeWidth={1.5}
              strokeDasharray="4 3"
            />
            <Line
              type="monotone"
              dataKey="ruleB_100"
              name={t("simulate.chart_legend_model")}
              stroke="#6366f1"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="ruleC_100"
              name={t("simulate.chart_legend_scorecard")}
              stroke="#0d9488"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              connectNulls={false}
            />
            <Line
              type="linear"
              dataKey="random_100"
              name={t("simulate.chart_legend_random")}
              stroke="#94a3b8"
              strokeWidth={1.5}
              strokeDasharray="5 5"
              dot={false}
              isAnimationActive={false}
            />
            {aScatter.length > 0 ? (
              <Scatter
                dataKey="ruleA"
                data={aScatter}
                name={t("simulate.chart_legend_observed")}
                fill="#f59e0b"
                isAnimationActive={false}
                line={false}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                shape={ChartRuleADot as any}
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600 dark:text-slate-400">
        <LegendDot color="#6366f1" label={t("simulate.chart_legend_model")} solid />
        <LegendDot
          color="#0d9488"
          label={t("simulate.chart_legend_scorecard")}
          solid
        />
        <LegendDot
          color="#94a3b8"
          label={t("simulate.chart_legend_random")}
          dashed
        />
        {aScatter.length > 0 ? (
          <LegendDot
            color="#d97706"
            label={t("simulate.chart_legend_observed")}
            marker
          />
        ) : null}
        <LegendDot
          color="#3f3fbf"
          label={t("simulate.chart_selection_marker")}
          dashed
        />
      </div>
    </div>
  );
}

function LegendDot({
  color,
  label,
  solid,
  dashed,
  marker,
}: {
  color: string;
  label: string;
  solid?: boolean;
  dashed?: boolean;
  marker?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {marker ? (
        <span
          className="inline-block h-3 w-3 shrink-0 rounded-full border-2"
          style={{
            borderColor: color,
            background: "transparent",
          }}
        />
      ) : (
        <span
          className="inline-block h-0.5 w-5 shrink-0 align-middle"
          style={{
            background: dashed
              ? `repeating-linear-gradient(90deg, ${color} 0 3px, transparent 3px 6px)`
              : color,
            borderTop: solid ? `1px solid ${color}` : undefined,
          }}
        />
      )}
      <span>{label}</span>
    </span>
  );
}
