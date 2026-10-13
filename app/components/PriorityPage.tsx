"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useT } from "@/hooks/useT";
import type { PriorityDistrictRow, PriorityTable } from "@/types/data-contract";

type SortKey = "rank_missed" | "district" | "province" | "poor_households" | "poor_missed" | "exclusion_error" | "triple_gap" | "poverty_rate" | "gain_b_per_1000" | "gain_c_per_1000";

export default function PriorityPage({ data }: { data: PriorityTable }) {
  const { t } = useT();
  const [province, setProvince] = useState("all");
  const [sort, setSort] = useState<SortKey>("poor_missed");
  const [descending, setDescending] = useState(true);
  const rows = useMemo(() => {
    const filtered = data.districts.filter((row) => province === "all" || row.province === province);
    return [...filtered].sort((a, b) => {
      const av = a[sort]; const bv = b[sort];
      const result = typeof av === "string" && typeof bv === "string" ? av.localeCompare(bv) : Number(av) - Number(bv);
      return descending ? -result : result;
    });
  }, [data.districts, province, sort, descending]);
  const provinces = [...new Set(data.districts.map((row) => row.province))].sort();
  const count = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? "—" : new Intl.NumberFormat("en").format(Math.round(value / 100) * 100);
  const pct = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? "—" : `${(value * 100).toFixed(1)}%`;
  const ci = (value: number | null | undefined, interval: [number, number] | null | undefined, isPct = false) => value == null || !interval ? "—" : `${isPct ? pct(value) : count(value)} (${isPct ? pct(interval[0]) : count(interval[0])}–${isPct ? pct(interval[1]) : count(interval[1])})`;
  const headers: { key: SortKey; label: string }[] = [
    { key: "rank_missed", label: t("priority.rank") }, { key: "district", label: t("priority.district") }, { key: "province", label: t("priority.province") },
    { key: "poor_households", label: t("priority.poor_households") }, { key: "poor_missed", label: t("priority.poor_missed") },
    { key: "exclusion_error", label: t("priority.exclusion") }, { key: "triple_gap", label: t("priority.triple_gap") }, { key: "poverty_rate", label: t("priority.poverty") },
    { key: "gain_b_per_1000", label: t("priority.gain_b") }, { key: "gain_c_per_1000", label: t("priority.gain_c") },
  ];
  const exportCsv = () => {
    const visibleRows = [data.national, ...rows];
    const csvRows = [headers.map((h) => h.label), ...visibleRows.map((row, index) => headers.map(({ key }) => {
      if (index === 0) return `"${(key === "rank_missed" ? "" : key === "district" ? t("priority.national") : key === "province" ? "" : key === "poor_households" ? count(row.poor_households) : key === "poor_missed" ? ci(row.poor_missed, row.poor_missed_ci) : key === "exclusion_error" ? ci(row.exclusion_error, row.exclusion_error_ci, true) : key === "triple_gap" ? ci(row.triple_gap, row.triple_gap_ci, true) : key === "poverty_rate" ? ci(row.poverty_rate, row.poverty_ci, true) : key === "gain_b_per_1000" ? row.gain_b_clear ? ci(row.gain_b_per_1000, row.gain_b_ci) : t("priority.not_clear") : row.gain_c_clear ? ci(row.gain_c_per_1000, row.gain_c_ci) : t("priority.not_clear")).replaceAll('"', '""')}"`;
      const value = key === "poor_households" ? count(row.poor_households) : key === "poor_missed" ? ci(row.poor_missed, row.poor_missed_ci) : key === "exclusion_error" ? ci(row.exclusion_error, row.exclusion_error_ci, true) : key === "triple_gap" ? ci(row.triple_gap, row.triple_gap_ci, true) : key === "poverty_rate" ? ci(row.poverty_rate, row.poverty_ci, true) : key === "gain_b_per_1000" ? row.gain_b_clear ? ci(row.gain_b_per_1000, row.gain_b_ci) : t("priority.not_clear") : key === "gain_c_per_1000" ? row.gain_c_clear ? ci(row.gain_c_per_1000, row.gain_c_ci) : t("priority.not_clear") : String(row[key]);
      return `"${value.replaceAll('"', '""')}"`;
    }))];
    const blob = new Blob([csvRows.map((row) => row.join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
    anchor.href = url; anchor.download = "reach-priority-districts.csv"; anchor.click(); URL.revokeObjectURL(url);
  };
  const renderRow = (row: PriorityDistrictRow, national = false) => <tr key={row.district} className="border-b border-slate-100 dark:border-slate-800">
    <td className="whitespace-nowrap px-3 py-2">{national ? "—" : row.rank_missed}</td>
    <td className="whitespace-nowrap px-3 py-2 font-medium">{national ? t("priority.national") : <Link className="text-indigo-700 underline dark:text-indigo-300" href={`/brief/${encodeURIComponent(row.district.toLowerCase())}`}>{row.district}</Link>}{row.small_cell ? <span className="ml-2 inline-flex rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900 dark:bg-amber-900/50 dark:text-amber-200">{t("priority.small_cell")}</span> : null}</td>
    <td className="whitespace-nowrap px-3 py-2">{row.province || "—"}</td><td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{count(row.poor_households)}</td><td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{ci(row.poor_missed, row.poor_missed_ci)}</td>
    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{ci(row.exclusion_error, row.exclusion_error_ci, true)}</td><td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{ci(row.triple_gap, row.triple_gap_ci, true)}</td><td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{ci(row.poverty_rate, row.poverty_ci, true)}</td>
    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{row.gain_b_clear ? ci(row.gain_b_per_1000, row.gain_b_ci) : t("priority.not_clear")}</td><td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{row.gain_c_clear ? ci(row.gain_c_per_1000, row.gain_c_ci) : t("priority.not_clear")}</td>
  </tr>;
  return <main className="mx-auto w-full min-w-0 max-w-7xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
    <h1 className="mb-3">{t("pages.priority_heading")}</h1><p className="mb-2 max-w-4xl text-sm text-slate-700 dark:text-slate-300">{t("priority.ranking_note")}</p><p className="mb-6 max-w-4xl text-sm text-slate-700 dark:text-slate-300">{t("priority.rounding_note")}</p>
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><label className="text-sm font-medium">{t("priority.province_filter")}<select value={province} onChange={(event) => setProvince(event.target.value)} className="ml-2 rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900"><option value="all">{t("priority.all_provinces")}</option>{provinces.map((item) => <option key={item}>{item}</option>)}</select></label><button type="button" onClick={exportCsv} className="rounded-md bg-indigo-700 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-800">{t("priority.download_csv")}</button></div>
    <div className="max-w-full overflow-x-auto rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"><table className="min-w-[1450px] border-collapse text-xs"><thead><tr className="bg-slate-50 text-left dark:bg-slate-800">{headers.map(({ key, label }) => <th key={key} aria-sort={sort === key ? (descending ? "descending" : "ascending") : "none"} className="px-3 py-3 font-semibold"><button type="button" onClick={() => { if (sort === key) setDescending((value) => !value); else { setSort(key); setDescending(false); } }} className="whitespace-nowrap underline decoration-dotted underline-offset-4">{label}{sort === key ? descending ? " ↓" : " ↑" : ""}</button></th>)}</tr></thead><tbody>{renderRow(data.national, true)}{rows.map((row) => renderRow(row))}</tbody></table></div>{rows.length === 0 ? <p role="status" className="mt-3 text-sm">{t("common.no_data")}</p> : null}
    <p className="mt-3 text-xs text-slate-600 dark:text-slate-400">{t("priority.small_cell_note")}</p>
  </main>;
}
