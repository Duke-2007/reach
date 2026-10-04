"use client";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useT } from "@/hooks/useT";
import type { ModelMetrics } from "@/types/data-contract";

export function ModelPage({ data }: { data: ModelMetrics }) {
  const { t } = useT();

  const { overall, decision_metrics_by_budget_pct, calibration, feature_importance_top10 } = data;

  // Prepare comparison data with random targeting series
  const comparisonData = decision_metrics_by_budget_pct.map((metric) => ({
    budget_pct: metric.budget_pct,
    model: metric.recall,
    random: metric.budget_pct / 100, // Random targeting: share reached equals budget share
  }));

  // Function to get readable feature label with fallback
  const getFeatureLabel = (feature: string) => {
    const key = `features.${feature}`;
    const translated = t(key);
    // If translation returns the key itself (no translation found), humanize the feature name
    if (translated === key) {
      return feature
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
    }
    return translated;
  };

  // Prepare feature importance data with readable labels
  const featureData = feature_importance_top10.map((item) => ({
    ...item,
    label: getFeatureLabel(item.feature),
  }));

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
        <div className="h-[300px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={calibration.deciles}
              margin={{ top: 5, right: 20, left: 40, bottom: 40 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="mean_predicted"
                tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
                label={{ value: t("model.calibration_xaxis"), position: "insideBottom", offset: -10 }}
                stroke="#64748b"
                fontSize={11}
              />
              <YAxis
                tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
                stroke="#64748b"
                fontSize={11}
              />
              <Tooltip
                formatter={(value: number, name: string) => [
                  `${(value * 100).toFixed(1)}%`,
                  name === "mean_predicted" ? t("model.calibration_xaxis") : t("model.calibration_yaxis"),
                ]}
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: "4px",
                  color: "#f1f5f9",
                }}
              />
              <Line
                type="monotone"
                dataKey="mean_observed"
                stroke="#6366f1"
                strokeWidth={2}
                dot={{ r: 4 }}
                name={t("model.calibration_decile")}
                aria-label={t("model.calibration_title")}
              />
              <Line
                data={[{ mean_predicted: 0, mean_observed: 0 }, { mean_predicted: 0.4, mean_observed: 0.4 }]}
                type="monotone"
                dataKey="mean_observed"
                stroke="#94a3b8"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                name={t("model.calibration_diagonal")}
                aria-label={t("model.calibration_diagonal")}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Feature Importance Chart */}
      <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 min-w-0">
        <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
          {t("model.feature_importance_title")}
        </h3>
        <div className="h-[400px] w-full min-w-0">
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
                tick={{ fontSize: 10, width: 100 }}
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
        </div>
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
        <div className="h-[300px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={comparisonData}
              margin={{ top: 5, right: 20, left: 40, bottom: 55 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="budget_pct"
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
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
          {t("model.comparison_not_available")}
        </p>
      </div>
    </div>
  );
}
