"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useT } from "@/hooks/useT";
import { formatPercent, formatPercentInterval } from "@/lib/format";
import { compareConfidenceIntervals, firstBriefRecommendation } from "@/lib/brief";
import type { BriefTargeting, DistrictGaps, DistrictRow } from "@/types/data-contract";

type Metric = "poverty_rate" | "exclusion_error" | "leakage" | "financial_access" | "triple_gap";
const METRICS: Metric[] = ["poverty_rate", "exclusion_error", "leakage", "financial_access", "triple_gap"];
const CI_KEYS: Record<Metric, keyof DistrictRow> = {
  poverty_rate: "poverty_ci", exclusion_error: "exclusion_error_ci", leakage: "leakage_ci",
  financial_access: "financial_access_ci", triple_gap: "triple_gap_ci",
};

function ciFor(row: DistrictRow, metric: Metric): [number, number] | undefined {
  const ci = row[CI_KEYS[metric]];
  return Array.isArray(ci) ? ci as [number, number] : undefined;
}
function norm(name: string) { return name.trim().toLocaleLowerCase(); }
function value(value: number | null | undefined) { return formatPercent(value); }
function interval(estimate: number | null | undefined, ci: [number, number] | undefined) {
  return formatPercentInterval(estimate, ci);
}

export function BriefPage({ slug, gaps, targeting, today, nationalExclusionCi }: {
  slug: string;
  gaps: DistrictGaps;
  targeting: BriefTargeting;
  today: string;
  nationalExclusionCi: [number, number] | null;
}) {
  const { t } = useT();
  const router = useRouter();
  const row = gaps.districts.find((d) => norm(d.district) === norm(slug));
  const districts = [...gaps.districts].sort((a, b) => a.district.localeCompare(b.district));
  if (!row) return <main className="district-brief mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
    <div className="mb-5 flex items-center gap-3 print:hidden">
      <label htmlFor="district-picker" className="text-sm font-medium">{t("brief.picker_label")}</label>
      <select id="district-picker" value="" onChange={(e) => { if (e.target.value) router.push(`/brief/${encodeURIComponent(e.target.value)}`); }} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:bg-slate-900">
        <option value="">{t("brief.picker_prompt")}</option>{districts.map((d) => <option key={d.district} value={d.district}>{d.district}</option>)}
      </select>
    </div>
    <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
      <h1>{t("brief.unknown_title")}</h1><p className="mt-2">{t("brief.unknown_body", { district: slug })}</p>
      <Link href="/" className="mt-4 inline-block font-medium text-indigo-700 underline dark:text-indigo-300">{t("brief.return_map")}</Link>
    </section>
  </main>;

  const national = gaps.national_averages;
  const others = gaps.districts.filter((d) => d.district !== row.district);
  const nearest = others.map((d) => ({ row: d, distance: Math.sqrt(
    ((d.poverty_rate - row.poverty_rate) ** 2) + ((d.exclusion_error - row.exclusion_error) ** 2) + ((d.financial_access - row.financial_access) ** 2),
  ) })).sort((a, b) => a.distance - b.distance).slice(0, 3).map((x) => x.row);
  const observed = (rule: "B" | "C") => targeting.at_observed_coverage.find((item) => norm(item.area) === norm(row.district) && item.rule === rule);
  const b = observed("B"); const c = observed("C");
  const exclusionCi = ciFor(row, "exclusion_error");
  const exclusionStatus = compareConfidenceIntervals(exclusionCi, nationalExclusionCi ?? undefined);
  const firstRecommendation = firstBriefRecommendation(Boolean(b?.clear_gain), Boolean(c?.clear_gain));
  const actions: string[] = [firstRecommendation];
  if (exclusionStatus === "above") actions.push("action_targeting");
  const tripleCi = ciFor(row, "triple_gap");
  if (tripleCi && tripleCi[0] > national.triple_gap) actions.push("action_access");
  if (row.small_cell) actions.push("action_small_cell");
  actions.push("action_monitor", "action_outreach", "action_evaluate");
  const selectedActions = actions.filter((key, index) => actions.indexOf(key) === index).slice(0, 3);
  const formatGain = (item: typeof b) => item ? `${Math.round(item.gain_per_1000_poor)} (${Math.round(item.gain_per_1000_poor_ci[0])}–${Math.round(item.gain_per_1000_poor_ci[1])})` : "—";

  return <main className="district-brief mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
    <div className="mb-5 flex flex-wrap items-center gap-3 print:hidden">
      <label htmlFor="district-picker" className="text-sm font-medium">{t("brief.picker_label")}</label>
      <select id="district-picker" value={row.district} onChange={(e) => { if (e.target.value) router.push(`/brief/${encodeURIComponent(e.target.value)}`); }} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:bg-slate-900">{districts.map((d) => <option key={d.district} value={d.district}>{d.district}</option>)}</select>
      <button type="button" onClick={() => window.print()} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-900">{t("brief.print")}</button>
    </div>
    <article className="space-y-4 text-slate-800 dark:text-slate-200">
      <header className="break-inside-avoid border-b border-slate-300 pb-3 dark:border-slate-700">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-700 dark:text-indigo-300">{t("brief.eyebrow")}</p>
        <h1 className="mt-1 text-3xl font-bold">{row.district}</h1>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{t("brief.date_source", { date: today })} · {t("brief.source")}</p>
      </header>

      <section className="break-inside-avoid">
        <h2 className="mb-2 text-lg">{t("brief.key_numbers")}</h2>
        <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="w-full border-collapse text-left text-xs sm:text-sm"><thead className="bg-slate-100 dark:bg-slate-800"><tr><th className="p-2">{t("brief.metric")}</th><th className="p-2">{row.district}</th><th className="p-2">{t("brief.national")}</th></tr></thead><tbody>
            {METRICS.map((metric) => <tr key={metric} className="border-t border-slate-200 dark:border-slate-700"><th className="p-2 font-medium">{t(`brief.metric_${metric}`)}</th><td className="p-2">{interval(row[metric], ciFor(row, metric))}</td><td className="p-2">{metric === "exclusion_error" ? formatPercentInterval(national[metric], nationalExclusionCi) : value(national[metric])}</td></tr>)}
          </tbody></table>
        </div>
      </section>

      <section className="break-inside-avoid rounded-lg bg-indigo-50 p-3 dark:bg-indigo-950/40"><h2 className="text-base">{t("brief.meaning_title")}</h2><p className="mt-1 text-sm">{t(`brief.meaning_${exclusionStatus === "unclear" ? "similar" : exclusionStatus}`, { district: row.district, district_value: value(row.exclusion_error), national_value: value(national.exclusion_error) })}</p></section>

      <section className="break-inside-avoid"><h2 className="mb-2 text-lg">{t("brief.actions_title")}</h2><ol className="list-decimal space-y-1 pl-5 text-sm">{selectedActions.map((key) => <li key={key}>{t(`brief.${key}`, { district: row.district })}</li>)}</ol></section>

      <section className="break-inside-avoid"><h2 className="mb-2 text-lg">{t("brief.comparison_title")}</h2><div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700"><table className="w-full text-left text-xs sm:text-sm"><thead className="bg-slate-100 dark:bg-slate-800"><tr><th className="p-2">{t("brief.district_col")}</th><th className="p-2">{t("brief.poverty_short")}</th><th className="p-2">{t("brief.exclusion_short")}</th><th className="p-2">{t("brief.access_short")}</th></tr></thead><tbody>
        <tr className="border-t border-slate-200 dark:border-slate-700"><th className="p-2">{t("brief.national")}</th><td className="p-2">{value(national.poverty_rate)}</td><td className="p-2">{value(national.exclusion_error)}</td><td className="p-2">{value(national.financial_access)}</td></tr>
        {nearest.map((d) => <tr key={d.district} className="border-t border-slate-200 dark:border-slate-700"><th className="p-2">{d.district}</th><td className="p-2">{value(d.poverty_rate)}</td><td className="p-2">{value(d.exclusion_error)}</td><td className="p-2">{value(d.financial_access)}</td></tr>)}
      </tbody></table></div><p className="mt-1 text-xs text-slate-800 dark:text-slate-200">{t("brief.nearest_note")}</p></section>

      <section className="break-inside-avoid"><h2 className="mb-2 text-lg">{t("brief.simulator_title")}</h2><div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700"><table className="w-full text-left text-xs sm:text-sm"><thead className="bg-slate-100 dark:bg-slate-800"><tr><th className="p-2">{t("brief.rule")}</th><th className="p-2">{t("brief.gain")}</th><th className="p-2">{t("brief.interpretation")}</th></tr></thead><tbody>{([ ["B", b], ["C", c] ] as const).map(([rule, item]) => <tr key={rule} className="border-t border-slate-200 dark:border-slate-700"><th className="p-2">{t(rule === "B" ? "brief.rule_b" : "brief.rule_c")}</th><td className="p-2">{item ? t("brief.gain_value", { gain: formatGain(item) }) : "—"}</td><td className="p-2">{!item ? "—" : item.clear_gain ? t("brief.clear_gain") : t("brief.not_clear")}</td></tr>)}</tbody></table></div><p className="mt-1 text-[11px] text-slate-500">{t("brief.simulator_note")}</p></section>

      <p className="break-inside-avoid border-t border-slate-300 pt-2 text-xs font-medium dark:border-slate-700">{t("brief.limitations")}</p>
    </article>
  </main>;
}
