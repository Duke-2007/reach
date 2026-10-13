"use client";

import { useT } from "@/hooks/useT";
import type { MethodFacts } from "@/types/data-contract";
import { formatPercentInterval } from "@/lib/format";

function number(value: number | null | undefined, digits = 0): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return Number(value.toFixed(digits)).toLocaleString("en");
}
function pct(value: number | null | undefined, digits = 1): string {
  return value == null || !Number.isFinite(value) ? "—" : `${number(value * 100, digits)}%`;
}
function interval(value: number | null | undefined, ci: [number, number] | null | undefined, percent = false, digits = 1): string {
  if (value == null || !ci) return "—";
  if (percent) return formatPercentInterval(value, ci, digits);
  const format = percent ? (n: number) => pct(n, digits) : (n: number) => number(n, digits);
  return `${format(value)} (${format(ci[0])}–${format(ci[1])})`;
}

export default function MethodPage({ facts }: { facts: MethodFacts }) {
  const { t } = useT();
  const rules = facts.rules_at_observed_coverage;
  const sensitivity = facts.model.sensitivity;
  const limits = [t("method.limit_district"), t("method.limit_programme_counts"), t("method.limit_extreme_poverty"), t("method.limit_reverse_causality"), t("method.limit_survey_label"), t("method.limit_individuals"), t("method.limit_financial_inclusion")];
  const definitions = [
    [t("method.definition_any_support_label"), t("method.definition_any_support")],
    [t("method.definition_exclusion_error_label"), t("method.definition_exclusion_error")],
    [t("method.definition_leakage_label"), t("method.definition_leakage")],
    [t("method.definition_triple_gap_label"), t("method.definition_triple_gap")],
    [t("method.definition_financially_excluded_label"), t("method.definition_financially_excluded")],
  ];
  const sensitivityLabels = [t("method.sensitivity_1"), t("method.sensitivity_2"), t("method.sensitivity_3")];

  return <main className="mx-auto w-full min-w-0 max-w-5xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
    <h1 className="mb-8">{t("pages.method_heading")}</h1>
    <section className="mb-8 min-w-0">
      <h2 className="mb-2">{t("method.what_title")}</h2>
      <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">{t("method.what_body")}</p>
    </section>
    <section className="mb-8 min-w-0">
      <h2 className="mb-2">{t("method.data_title")}</h2>
      <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">{t("method.data_body", { n_households: number(facts.data.n_households), n_districts: number(facts.data.n_districts), n_strata: number(facts.data.n_strata), n_clusters: number(facts.data.n_clusters), survey: facts.data.survey, persons_poor: pct(facts.poverty.persons_poor), persons_extreme_poor: pct(facts.poverty.persons_extreme_poor) })}</p>
    </section>
    <section className="mb-8 min-w-0">
      <h2 className="mb-2">{t("method.read_title")}</h2>
      <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">{t("method.read_body")}</p>
    </section>
    <section className="mb-8 min-w-0">
      <h2 className="mb-3">{t("method.findings_title")}</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <p className="min-w-0 rounded-md border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-900">{t("method.exclusion", { value: interval(facts.headline.exclusion_error, facts.headline.exclusion_error_ci, true) })}</p>
        <p className="min-w-0 rounded-md border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-900">{t("method.leakage", { value: interval(facts.headline.leakage, facts.headline.leakage_ci, true) })}</p>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">{t("method.rule_findings", { budget_share: pct(rules.budget_share), observed: pct(rules.observed_poor_reached), b_reached_interval: formatPercentInterval(rules.B.poor_reached, rules.B.poor_reached_ci), b_gain: number(rules.B.gain_per_1000), b_interval: rules.B.gain_ci ? `${number(rules.B.gain_ci[0])}–${number(rules.B.gain_ci[1])}` : "—", c_reached_interval: formatPercentInterval(rules.C.poor_reached, rules.C.poor_reached_ci), c_gain: number(rules.C.gain_per_1000), c_interval: rules.C.gain_ci ? `${number(rules.C.gain_ci[0])}–${number(rules.C.gain_ci[1])}` : "—", b_districts: number(rules.districts_where_B_clearly_better), n_districts: number(facts.data.n_districts), c_districts: number(rules.districts_where_C_clearly_better) })}</p>
    </section>
    <section className="mb-8 min-w-0">
      <h2 className="mb-2">{t("method.robust_title")}</h2>
      <p className="mb-3 text-sm text-slate-700 dark:text-slate-300">{t("method.auc", { auc: number(facts.model.auc, 3), ci: facts.model.auc_ci ? `${number(facts.model.auc_ci[0], 3)}–${number(facts.model.auc_ci[1], 3)}` : "—" })}</p>
      {sensitivity ? <div className="max-w-full overflow-x-auto rounded-md border border-slate-200 dark:border-slate-700"><table className="w-full min-w-[620px] border-collapse text-sm"><thead><tr className="bg-slate-50 text-left dark:bg-slate-800"><th className="px-3 py-2">{t("method.sensitivity_label")}</th><th className="px-3 py-2">{t("method.sensitivity_auc")}</th><th className="px-3 py-2">{t("method.sensitivity_reach")}</th></tr></thead><tbody>{sensitivity.map((item, index) => <tr key={`${item.feature_set}-${index}`} className="border-t border-slate-200 dark:border-slate-700"><td className="px-3 py-2">{sensitivityLabels[index] ?? "—"}</td><td className="px-3 py-2 tabular-nums">{interval(item.auc, item.auc_ci, false, 3)}</td><td className="px-3 py-2 tabular-nums">{pct(item.poor_reached_at_observed_coverage)}</td></tr>)}</tbody></table></div> : null}
    </section>
    <section className="mb-8 min-w-0">
      <h2 className="mb-2">{t("method.limits_title")}</h2>
      <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">{limits.map((item) => <li key={item}>{item}</li>)}</ul>
    </section>
    <section className="min-w-0">
      <h2 className="mb-2">{t("method.definitions_title")}</h2>
      <dl className="space-y-3">{definitions.map(([label, definition]) => <div key={label}><dt className="text-sm font-semibold">{label}</dt><dd className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">{definition}</dd></div>)}</dl>
    </section>
  </main>;
}
