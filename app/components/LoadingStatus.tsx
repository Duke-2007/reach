"use client";

import { useT } from "@/hooks/useT";

export function LoadingStatus() {
  const { t } = useT();
  return (
    <p role="status" className="p-6 text-sm text-slate-700 dark:text-slate-300">
      {t("common.loading")}
    </p>
  );
}
