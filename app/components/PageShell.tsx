"use client";

import type { ReactNode } from "react";
import { I18nProvider, useT } from "@/hooks/useT";

function Inner({
  titleKey,
  titleValues,
  children,
}: {
  titleKey: string;
  titleValues?: Record<string, string | number>;
  children?: ReactNode;
}) {
  const { t } = useT();
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="mb-6 max-w-4xl text-2xl font-semibold leading-tight tracking-tight text-slate-950 dark:text-slate-50 sm:text-3xl">
        {t(titleKey, titleValues)}
      </h1>
      <div className="space-y-4 text-slate-700 dark:text-slate-300">
        <p className="max-w-3xl">{t("pages.body_coming_soon")}</p>
        {children}
      </div>
    </main>
  );
}

export default function PageShell({
  titleKey,
  titleValues,
  children,
}: {
  titleKey: string;
  titleValues?: Record<string, string | number>;
  children?: ReactNode;
}) {
  return (
    <I18nProvider>
      <Inner titleKey={titleKey} titleValues={titleValues}>
        {children}
      </Inner>
    </I18nProvider>
  );
}
