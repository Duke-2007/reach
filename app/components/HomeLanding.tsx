"use client";

import Link from "next/link";
import { useState } from "react";
import { useT } from "@/hooks/useT";
import type { MethodFacts } from "@/types/data-contract";
import { formatPercentInterval } from "@/lib/format";

function fmt(value: number | null | undefined, digits: number): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return Number(value.toFixed(digits)).toLocaleString("en");
}
function pct(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? "—" : `${fmt(value * 100, 1)}%`;
}

export default function HomeLanding({ facts }: { facts: MethodFacts }) {
  const { t } = useT();
  const [orientationVisible, setOrientationVisible] = useState(true);
  const ci = facts.headline.exclusion_error_ci;
  const gainCi = facts.rules_at_observed_coverage.B.gain_ci;
  const exclusion = formatPercentInterval(facts.headline.exclusion_error, ci);
  const gain = facts.rules_at_observed_coverage.B.gain_per_1000 == null || !gainCi ? "—" : `${fmt(facts.rules_at_observed_coverage.B.gain_per_1000, 0)} (${fmt(gainCi[0], 0)}–${fmt(gainCi[1], 0)})`;

  return <section className="mx-auto mb-8 w-full min-w-0 max-w-7xl px-4 pt-8 sm:px-6 sm:pt-10">
    <h1 className="mb-5 max-w-4xl">{t("home_landing.title")}</h1>
    <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2">
      <article className="min-w-0 rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"><h2 className="mb-2 text-sm font-semibold">{t("home_landing.exclusion_label")}</h2><p className="text-xl font-semibold tabular-nums">{exclusion}</p></article>
      <article className="min-w-0 rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"><h2 className="mb-2 text-sm font-semibold">{t("home_landing.gain_label", { budget_share: pct(facts.rules_at_observed_coverage.budget_share) })}</h2><p className="text-xl font-semibold tabular-nums">{gain}</p></article>
    </div>
    <div className="mt-4 flex flex-wrap gap-3"><Link href="/simulate" className="rounded-md bg-indigo-700 px-4 py-2 text-sm font-semibold text-white transition-transform duration-150 motion-safe:active:scale-[0.97] motion-reduce:transition-none hover:bg-indigo-800">{t("home_landing.simulator_button")}</Link><Link href="/priority" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 transition-transform duration-150 motion-safe:active:scale-[0.97] motion-reduce:transition-none hover:bg-slate-100 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800">{t("home_landing.priority_button")}</Link></div>
    <div className="mt-4">
      {orientationVisible ? <section aria-labelledby="home-orientation-title" className="rounded-md border border-slate-200 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-300">
        <div className="flex items-start justify-between gap-3">
          <h2 id="home-orientation-title" className="text-sm font-semibold">{t("home.orientation_title")}</h2>
          <button type="button" onClick={() => setOrientationVisible(false)} className="shrink-0 text-xs underline underline-offset-2">{t("home.orientation_hide")}</button>
        </div>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>{t("home.orientation_step1")}</li>
          <li>{t("home.orientation_step2")}</li>
          <li>{t("home.orientation_step3")}</li>
        </ol>
      </section> : <button type="button" onClick={() => setOrientationVisible(true)} className="text-sm text-slate-600 underline underline-offset-2 dark:text-slate-300">{t("home.orientation_show")}</button>}
    </div>
  </section>;
}
