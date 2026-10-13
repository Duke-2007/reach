"use client";

import {
  BarChart,
  Bar,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Scatter,
} from "recharts";
import { useT } from "@/hooks/useT";
import type { ModelMetrics } from "@/types/data-contract";

export default function ModelPage({ data }: { data: ModelMetrics }) {
  const { t } = useT();

  const { overall, decision_metrics_by_budget_pct, calibration, feature_importance_top10 } = data;

  // Compare ranked rules across budgets, with observed/model/random values at
  // the programme's exact observed coverage overlaid as three points.
  const comparisonData = decision_metrics_by_budget_pct.map((metric) => ({
    budget_pct: metric.budget_pct,
    model: metric.recall,
    random: metric.budget_pct / 100, // Random targeting: share reached equals budget share
  }));
  const observedComparison = data.comparison_at_observed_coverage;
  const coveragePoint = (poor_reached: number) => [{
    budget_pct: observedComparison.budget_share * 100,
    poor_reached,
  }];

  // Function to get readable feature label with fallback
  // Labels are generated alongside the feature values in model_metrics.json.
  const featureData = feature_importance_top10.map((item) => ({
    ...item,
    label: item.label,
  }));
  const calibrationMax = Math.max(
    0,
    ...calibration.deciles.flatMap((point) => [point.mean_predicted, point.mean_observed]),
  );
  const calibrationDomainMax = Math.max(0.1, Math.ceil(calibrationMax * 10) / 10);
  const calibrationDiagonal = [
    { mean_predicted: 0, mean_observed: 0 },
    { mean_predicted: calibrationDomainMax, mean_observed: calibrationDomainMax },
  ];

  return (
    <div className="flex flex-col gap-6 min-w-0">
      {/* AUC Card */}
      <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 min-w-0">
        <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
          {t("model.auc_label")}
        </h3>
        <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {overall.auc_roc_mean.toFixed(3)} ± {overall.auc_roc_std.toFixed(3)}
        </div>
      </div>

      {/* Budget Metrics Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 min-w-0">
        {decision_metrics_by_budget_pct.map((metric) => (
          <div
            key={metric.budget_pct}
            className="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 min-w-0"
          >
            <h4 className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-400">
              {t("model.budget_label")}: {metric.budget_pct}%
            </h4>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">{t("model.poor_reached_label")}:</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {(metric.recall * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">{t("model.exclusion_error_label")}:</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {(metric.exclusion_error * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">{t("model.leakage_label")}:</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {(metric.leakage * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Calibration Chart */}
      <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 min-w-0">
        <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
          {t("model.calibration_title")}
        </h3>
        {calibration.deciles.length > 0 ? <div className="h-[300px] w-full min-w-0" role="img" aria-label={t("model.calibration_title")}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={calibration.deciles}
              margin={{ top: 5, right: 20, left: 45, bottom: 45 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="mean_predicted"
                type="number"
                domain={[0, calibrationDomainMax]}
                tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
                label={{ value: t("model.calibration_xaxis"), position: "insideBottom", offset: -10 }}
                stroke="#64748b"
                fontSize={11}
              />
              <YAxis
                type="number"
                dataKey="mean_observed"
                domain={[0, calibrationDomainMax]}
                tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
                label={{ value: t("model.calibration_yaxis"), angle: -90, position: "insideLeft", offset: -28 }}
                stroke="#64748b"
                fontSize={11}
              />
              <Tooltip
                content={({ active, payload }) => {
                  const point = payload?.find((entry) => entry.payload?.decile != null)?.payload as
                    | { decile: number; mean_predicted: number; mean_observed: number; n_households: number }
                    | undefined;
                  if (!active || !point) return null;
                  return (
                    <div className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 shadow-lg">
                      <p className="mb-1 font-semibold">{t("model.calibration_decile", { n: point.decile })}</p>
                      <p>{t("model.calibration_xaxis")}: {(point.mean_predicted * 100).toFixed(1)}%</p>
                      <p>{t("model.calibration_yaxis")}: {(point.mean_observed * 100).toFixed(1)}%</p>
                      <p>{t("model.calibration_n_households")}: {point.n_households.toLocaleString()}</p>
                    </div>
                  );
                }}
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: "4px",
                  color: "#f1f5f9",
                }}
              />
              <Scatter
                data={calibration.deciles}
                dataKey="mean_observed"
                stroke="#6366f1"
                fill="#6366f1"
                line={{ stroke: "#6366f1", strokeWidth: 2 }}
                name={t("model.calibration_title")}
                aria-label={t("model.calibration_title")}
                isAnimationActive={false}
              />
              <Line
                data={calibrationDiagonal}
                dataKey="mean_observed"
                stroke="#94a3b8"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                name={t("model.calibration_diagonal")}
                aria-label={t("model.calibration_diagonal")}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div> : <p role="status" className="text-sm text-slate-700 dark:text-slate-300">{t("model.no_data")}</p>}
        {calibration.deciles.length > 0 ? <details className="mt-3 text-sm"><summary className="cursor-pointer font-medium underline">{t("model.show_data_table")}</summary><div className="mt-2 max-w-full overflow-x-auto"><table className="w-full border-collapse text-xs"><thead><tr><th className="p-2 text-left">{t("model.calibration_decile", { n: "" })}</th><th className="p-2 text-right">{t("model.calibration_xaxis")}</th><th className="p-2 text-right">{t("model.calibration_yaxis")}</th><th className="p-2 text-right">{t("model.calibration_n_households")}</th></tr></thead><tbody>{calibration.deciles.map((point) => <tr key={point.decile} className="border-t"><th className="p-2 text-left">{point.decile}</th><td className="p-2 text-right">{(point.mean_predicted * 100).toFixed(1)}%</td><td className="p-2 text-right">{(point.mean_observed * 100).toFixed(1)}%</td><td className="p-2 text-right">{point.n_households.toLocaleString()}</td></tr>)}</tbody></table></div></details> : null}
      </div>

      {/* Feature Importance Chart */}
      <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 min-w-0">
        <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
          {t("model.feature_importance_title")}
        </h3>
        {featureData.length > 0 ? <div className="h-[400px] w-full min-w-0" role="img" aria-label={t("model.feature_importance_title")}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={featureData}
              layout="vertical"
              margin={{ top: 5, right: 20, left: 5, bottom: 5 }}
              barSize={20}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                type="number"
                tickFormatter={(value) => value.toFixed(3)}
                stroke="#64748b"
                fontSize={12}
              />
              <YAxis
                type="category"
                dataKey="label"
                width={165}
                tick={<FeatureAxisTick />}
                stroke="#64748b"
              />
              <Tooltip
                formatter={(value: number, name: string) => [
                  value.toFixed(3),
                  name === "importance" ? t("model.importance") : name,
                ]}
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: "4px",
                  color: "#f1f5f9",
                }}
              />
              <Bar dataKey="importance" fill="#6366f1" aria-label={t("model.feature_importance_title")} />
            </BarChart>
          </ResponsiveContainer>
        </div> : <p role="status" className="text-sm text-slate-700 dark:text-slate-300">{t("model.no_data")}</p>}
        {featureData.length > 0 ? <details className="mt-3 text-sm"><summary className="cursor-pointer font-medium underline">{t("model.show_data_table")}</summary><div className="mt-2 max-w-full overflow-x-auto"><table className="w-full border-collapse text-xs"><thead><tr><th className="p-2 text-left">{t("model.feature")}</th><th className="p-2 text-right">{t("model.importance")}</th></tr></thead><tbody>{featureData.map((item) => <tr key={item.feature} className="border-t"><th className="p-2 text-left">{item.label}</th><td className="p-2 text-right">{item.importance.toFixed(3)}</td></tr>)}</tbody></table></div></details> : null}
      </div>

      {/* Limitations Box */}
      <div className="rounded-md border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/50 min-w-0">
        <h3 className="mb-2 text-sm font-semibold text-amber-900 dark:text-amber-100">
          {t("model.limitations_title")}
        </h3>
        <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-200">
          {t("model.limitations_text")}
        </p>
      </div>

      {/* Model vs Random Comparison */}
      <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 min-w-0">
        <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
          {t("model.comparison_title")}
        </h3>
        {comparisonData.length > 0 ? <div className="h-[300px] w-full min-w-0" role="img" aria-label={t("model.comparison_title")}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={comparisonData}
              margin={{ top: 5, right: 20, left: 40, bottom: 55 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="budget_pct"
                type="number"
                domain={[0, 40]}
                ticks={[0, 10, 20, 30, 40]}
                tickFormatter={(value) => `${value}%`}
                stroke="#64748b"
                fontSize={11}
              />
              <YAxis
                domain={[0, 1]}
                tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
                stroke="#64748b"
                fontSize={11}
              />
              <Tooltip
                formatter={(value: number, name: string) => [
                  `${(value * 100).toFixed(1)}%`,
                  name,
                ]}
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: "4px",
                  color: "#f1f5f9",
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="model"
                stroke="#6366f1"
                strokeWidth={2}
                name={t("model.model")}
                aria-label={t("model.model")}
              />
              <Line
                type="monotone"
                dataKey="random"
                stroke="#94a3b8"
                strokeWidth={2}
                strokeDasharray="5 5"
                name={t("model.random")}
                aria-label={t("model.random")}
              />
              <Scatter data={coveragePoint(observedComparison.observed.poor_reached)} dataKey="poor_reached" name={t("model.observed")} fill="#f59e0b" isAnimationActive={false} />
              <Scatter data={coveragePoint(observedComparison.model.poor_reached)} dataKey="poor_reached" name={t("model.model_at_coverage")} fill="#6366f1" isAnimationActive={false} />
              <Scatter data={coveragePoint(observedComparison.random.poor_reached)} dataKey="poor_reached" name={t("model.random_at_coverage")} fill="#94a3b8" isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div> : <p role="status" className="text-sm text-slate-700 dark:text-slate-300">{t("model.no_data")}</p>}
        {comparisonData.length > 0 ? <details className="mt-3 text-sm"><summary className="cursor-pointer font-medium underline">{t("model.show_data_table")}</summary><div className="mt-2 max-w-full overflow-x-auto"><table className="w-full border-collapse text-xs"><thead><tr><th className="p-2 text-left">{t("model.budget_label")}</th><th className="p-2 text-right">{t("model.model")}</th><th className="p-2 text-right">{t("model.random")}</th></tr></thead><tbody>{comparisonData.map((point) => <tr key={point.budget_pct} className="border-t"><th className="p-2 text-left">{point.budget_pct}%</th><td className="p-2 text-right">{(point.model * 100).toFixed(1)}%</td><td className="p-2 text-right">{(point.random * 100).toFixed(1)}%</td></tr>)}</tbody></table></div></details> : null}
        <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
          {t("model.observed_coverage_note", { coverage: (observedComparison.budget_share * 100).toFixed(1) })}
        </p>
      </div>
    </div>
  );
}

function FeatureAxisTick({ x = 0, y = 0, payload }: {
  x?: number;
  y?: number;
  payload?: { value?: string };
}) {
  const words = String(payload?.value ?? "").split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (line && `${line} ${word}`.length > 25) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  const startY = y - ((lines.length - 1) * 5);
  return (
    <text x={x} y={startY} textAnchor="end" className="fill-slate-700 dark:fill-slate-200 text-[9px] sm:text-[10px]">
      {lines.map((text, index) => (
        <tspan key={`${index}-${text}`} x={x} dy={index === 0 ? 0 : 11}>{text}</tspan>
      ))}
    </text>
  );
}
