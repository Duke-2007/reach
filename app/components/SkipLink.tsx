"use client";

import { useT } from "@/hooks/useT";

export function SkipLink() {
  const { t } = useT();
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-3 focus:text-slate-950 focus:shadow-lg"
    >
      {t("common.skip_to_content")}
    </a>
  );
}
