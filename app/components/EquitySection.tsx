"use client";

import type { Equity } from "@/types/data-contract";
import { useT } from "@/hooks/useT";

export default function EquitySection({ data }: { data: Equity }) {
  const { t } = useT();
  const pct = (v: number | null | undefined) => v == null || !Number.isFinite(v) ? "—" : `${(v * 100).toFixed(1)}%`;
  const gain = (v: number | null | undefined, ci: [number, number] | null | undefined, clear: boolean) => !clear ? t("equity.not_clear") : v == null || !ci ? "—" : `${Math.round(v)} (${Math.round(ci[0])}–${Math.round(ci[1])})`;
  const coverage = `${(data.budget_share * 100).toFixed(1)}%`;
  const unclearGroups = data.groups.filter((row) => !row.gain_B_clear).map((row) => row.group);
  return <section className="mt-6 min-w-0 rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
    <h2 className="mb-2 text-lg font-semibold">{t("equity.title")}</h2>
    <p className="mb-4 text-sm text-slate-700 dark:text-slate-300">{t("equity.description", { budget_share: coverage })}</p>
    {data.groups.length === 0 ? <p role="status" className="rounded border border-dashed p-4 text-sm">{t("common.no_data")}</p> : <div className="max-w-full overflow-x-auto rounded border border-slate-200 dark:border-slate-700"><table className="min-w-[980px] border-collapse text-xs"><thead><tr className="bg-slate-50 text-left dark:bg-slate-800"><th className="px-3 py-2">{t("equity.dimension")}</th><th className="px-3 py-2">{t("equity.group")}</th><th className="px-3 py-2 text-right">{t("equity.share")}</th><th className="px-3 py-2 text-right">{t("equity.observed")}</th><th className="px-3 py-2 text-right">{t("equity.rule_b")}</th><th className="px-3 py-2 text-right">{t("equity.rule_c")}</th><th className="px-3 py-2 text-right">{t("equity.gain_b")}</th></tr></thead><tbody>{data.groups.map((row) => <tr key={`${row.dimension}-${row.group}`} className="border-t border-slate-100 dark:border-slate-800"><td className="whitespace-nowrap px-3 py-2">{row.dimension}</td><td className="whitespace-nowrap px-3 py-2 font-medium">{row.group}{row.small_cell ? <span className="ml-2 inline-flex rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900 dark:bg-amber-900/50 dark:text-amber-200">{t("equity.small_cell")}</span> : null}</td><td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{pct(row.share_of_poor_households)}</td><td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{pct(row.reach_A)} ({pct(row.reach_A_ci?.[0])}–{pct(row.reach_A_ci?.[1])})</td><td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{pct(row.reach_B)} ({pct(row.reach_B_ci?.[0])}–{pct(row.reach_B_ci?.[1])})</td><td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{pct(row.reach_C)} ({pct(row.reach_C_ci?.[0])}–{pct(row.reach_C_ci?.[1])})</td><td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{gain(row.gain_B_per_1000, row.gain_B_ci, row.gain_B_clear)}</td></tr>)}</tbody></table></div>}
    <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">{t("equity.interval_note")}</p>
    <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{t("equity.gain_not_clear", { groups: unclearGroups.length ? unclearGroups.join(", ") : t("equity.none") })}</p>
    <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{t("equity.interpretation_note")}</p>
  </section>;
}
