"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useT } from "@/hooks/useT";
import type { PriorityDistrictRow } from "@/types/data-contract";

export default function BriefIndex({ districts }: { districts: PriorityDistrictRow[] }) {
  const { t } = useT();
  const router = useRouter();
  const ranked = [...districts].sort((a, b) => (a.rank_missed ?? 999) - (b.rank_missed ?? 999));
  return <main className="mx-auto w-full min-w-0 max-w-5xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
    <h1 className="mb-3">{t("brief.index_title")}</h1>
    <p className="mb-5 text-sm text-slate-700 dark:text-slate-300">{t("brief.index_body")}</p>
    <label className="mb-6 block text-sm font-medium" htmlFor="brief-district-picker">{t("brief.picker_label")}
      <select id="brief-district-picker" defaultValue="" onChange={(event) => { if (event.target.value) router.push(`/brief/${encodeURIComponent(event.target.value)}`); }} className="mt-1 block w-full max-w-md rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
        <option value="">{t("brief.picker_prompt")}</option>{ranked.map((row) => <option key={row.district} value={row.district}>{row.district}</option>)}
      </select>
    </label>
    <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {ranked.map((row) => <li key={row.district} className="min-w-0 rounded-md border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"><span className="mr-3 tabular-nums text-slate-500">{row.rank_missed ?? "—"}</span><Link className="font-medium text-indigo-700 underline dark:text-indigo-300" href={`/brief/${encodeURIComponent(row.district.toLowerCase())}`}>{row.district}</Link></li>)}
    </ol>
  </main>;
}
