"use client";

import { useT } from "@/hooks/useT";
import Link from "next/link";

export function AppFooter() {
  const { t } = useT();
  return (
    <footer className="mt-auto border-t border-slate-200 bg-white/60 px-4 py-5 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <p className="max-w-3xl leading-6 opacity-95">{t("footer.line1")}</p>
        <Link href="/method" className="mt-2 inline-block font-medium text-indigo-700 underline dark:text-indigo-300">{t("footer.method_link")}</Link>
      </div>
    </footer>
  );
}
