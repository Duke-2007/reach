"use client";

import { useT } from "@/hooks/useT";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useT();
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6" role="alert">
      <h1 className="text-xl font-semibold">{t("common.error_title")}</h1>
      <p className="mt-2 text-slate-700 dark:text-slate-300">{t("common.error_body")}</p>
      <button type="button" onClick={reset} className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700 dark:bg-slate-100 dark:text-slate-900 dark:focus-visible:outline-indigo-300">
        {t("common.retry")}
      </button>
    </main>
  );
}
