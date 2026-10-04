"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useT } from "@/hooks/useT";
import type { Profiles, TraitMeta, TraitComparison } from "@/types/data-contract";

interface BarWithWhiskerProps {
  fill: string;
  x: number;
  y: number;
  width: number;
  height: number;
  payload: {
    missed_ci: [number, number];
    covered_ci: [number, number];
    missed: number;
    covered: number;
  };
  dataKey: string;
}

function BarWithWhisker({ fill, x, y, width, height, payload, dataKey }: BarWithWhiskerProps) {
  const value = dataKey === "missed" ? payload.missed : payload.covered;
  const ci = dataKey === "missed" ? payload.missed_ci : payload.covered_ci;
  const [lower, upper] = ci;

  // Skip whisker if value is zero or negative
  if (value <= 0) {
    return <rect x={x} y={y} width={width} height={height} fill={fill} />;
  }

  // Calculate pixel positions for whisker
  const pxPerUnit = width / value;
  const lowerX = x + pxPerUnit * lower;
  const upperX = x + pxPerUnit * upper;
  const centerY = y + height / 2;
  const capHeight = 6;

  const whiskerId = `whisker-${dataKey}-${x}-${y}`;

  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} />
      <line
        key={`${whiskerId}-line`}
        x1={lowerX}
        y1={centerY}
        x2={upperX}
        y2={centerY}
        stroke="#0f172a"
        strokeWidth={2}
      />
      <line
        key={`${whiskerId}-cap-lower`}
        x1={lowerX}
        y1={centerY - capHeight / 2}
        x2={lowerX}
        y2={centerY + capHeight / 2}
        stroke="#0f172a"
        strokeWidth={2}
      />
      <line
        key={`${whiskerId}-cap-upper`}
        x1={upperX}
        y1={centerY - capHeight / 2}
        x2={upperX}
        y2={centerY + capHeight / 2}
        stroke="#0f172a"
        strokeWidth={2}
      />
    </g>
  );
}

export function MissedPage({ data }: { data: Profiles }) {
  const { t } = useT();
  const defaultArea = data.by_area[0]?.area ?? "";
  const [selectedArea, setSelectedArea] = useState(defaultArea);

  const areaData = data.by_area.find((a) => a.area === selectedArea);

  if (!areaData) {
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 p-6 text-center text-amber-900 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-100">
        {t("missed.no_data")}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 min-w-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between min-w-0">
        <label htmlFor="district-select" className="text-sm font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
          {t("missed.district_label")}
        </label>
        <select
          id="district-select"
          value={selectedArea}
          onChange={(e) => setSelectedArea(e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 min-w-0 max-w-full"
        >
          {data.by_area.map((area) => (
            <option key={area.area} value={area.area}>
              {area.area === "national" ? t("missed.district_national") : area.area}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 min-w-0">
        {data.traits_metadata.map((trait) => {
          const comparison = areaData.traits[trait.key];
          if (!comparison) return null;

          return (
            <TraitChart
              key={trait.key}
              trait={trait}
              comparison={comparison}
            />
          );
        })}
      </div>
    </div>
  );
}

function TraitChart({
  trait,
  comparison,
}: {
  trait: TraitMeta;
  comparison: TraitComparison;
}) {
  const { t } = useT();

  const chartData = [
    {
      name: t("missed.chart_aria", { trait: trait.label }),
      missed: comparison.missed,
      covered: comparison.covered,
      missed_ci: comparison.missed_ci,
      covered_ci: comparison.covered_ci,
    },
  ];

  const isProportion = trait.type === "proportion";

  // Calculate x-axis domain to include the largest upper bound
  const maxUpper = Math.max(comparison.missed_ci[1], comparison.covered_ci[1]);
  const xDomain = [0, maxUpper * 1.05]; // Add 5% padding

  const valueFormatter = (value: number) => {
    if (isProportion) {
      return `${Math.round(value * 100)}%`;
    }
    return value.toFixed(1);
  };

  const ciOverlap = !(comparison.missed_ci[1] < comparison.covered_ci[0] || comparison.covered_ci[1] < comparison.missed_ci[0]);

  const insightKeyMap: Record<string, { higher_missed: string; higher_covered: string }> = {
    household_size: {
      higher_missed: "missed.insight_household_size_higher_missed",
      higher_covered: "missed.insight_household_size_higher_covered",
    },
    electricity_pct: {
      higher_missed: "missed.insight_electricity_higher_missed",
      higher_covered: "missed.insight_electricity_higher_covered",
    },
    improved_water_pct: {
      higher_missed: "missed.insight_water_higher_missed",
      higher_covered: "missed.insight_water_higher_covered",
    },
    improved_toilet_pct: {
      higher_missed: "missed.insight_toilet_higher_missed",
      higher_covered: "missed.insight_toilet_higher_covered",
    },
    head_primary_plus_pct: {
      higher_missed: "missed.insight_education_higher_missed",
      higher_covered: "missed.insight_education_higher_covered",
    },
    distance_health_km: {
      higher_missed: "missed.insight_distance_higher_missed",
      higher_covered: "missed.insight_distance_higher_covered",
    },
    owns_mobile_phone_pct: {
      higher_missed: "missed.insight_phone_higher_missed",
      higher_covered: "missed.insight_phone_higher_covered",
    },
    agriculture_main_pct: {
      higher_missed: "missed.insight_agriculture_higher_missed",
      higher_covered: "missed.insight_agriculture_higher_covered",
    },
  };

  let insight: string;
  if (ciOverlap) {
    insight = t("missed.insignificant");
  } else if (comparison.missed > comparison.covered) {
    const keys = insightKeyMap[trait.key] || { higher_missed: "missed.higher_missed" };
    insight = t(keys.higher_missed, {
      missed: valueFormatter(comparison.missed),
      covered: valueFormatter(comparison.covered),
    });
  } else {
    const keys = insightKeyMap[trait.key] || { higher_covered: "missed.higher_covered" };
    insight = t(keys.higher_covered, {
      covered: valueFormatter(comparison.covered),
      missed: valueFormatter(comparison.missed),
    });
  }

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 min-w-0">
      <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{trait.label}</h3>
      <div className="h-[200px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: isProportion ? 30 : 15, bottom: 5 }}
            barSize={20}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              type="number"
              domain={xDomain}
              tickFormatter={valueFormatter}
              stroke="#64748b"
              fontSize={12}
            />
            <YAxis
              type="category"
              dataKey="name"
              hide
            />
            <Tooltip
              formatter={(value: number, name: string) => {
                const ci = name === "missed" ? comparison.missed_ci : comparison.covered_ci;
                const ciLower = isProportion ? Math.round(ci[0] * 100) : ci[0].toFixed(1);
                const ciUpper = isProportion ? Math.round(ci[1] * 100) : ci[1].toFixed(1);
                return [
                  `${valueFormatter(value)} (${ciLower}–${ciUpper})`,
                  name === "missed" ? t("missed.trait_missed") : t("missed.trait_covered"),
                ];
              }}
              contentStyle={{
                backgroundColor: "#1e293b",
                border: "1px solid #334155",
                borderRadius: "4px",
                color: "#f1f5f9",
              }}
            />
            <Bar
              dataKey="missed"
              fill="#6366f1"
              name={t("missed.trait_missed")}
              aria-label={t("missed.chart_aria", { trait: trait.label })}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              shape={(props: any) => <BarWithWhisker {...props} dataKey="missed" />}
            />
            <Bar
              dataKey="covered"
              fill="#14b8a6"
              name={t("missed.trait_covered")}
              aria-label={t("missed.chart_aria", { trait: trait.label })}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              shape={(props: any) => <BarWithWhisker {...props} dataKey="covered" />}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-slate-600 dark:text-slate-400 break-words">{insight}</p>
      <div className="mt-2 flex items-center gap-4 text-xs text-slate-500 dark:text-slate-500 min-w-0">
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded bg-indigo-500" />
          <span>{t("missed.trait_missed")}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded bg-teal-500" />
          <span>{t("missed.trait_covered")}</span>
        </div>
      </div>
    </div>
  );
}
