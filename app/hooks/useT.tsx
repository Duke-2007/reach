"use client";

import en from "@/i18n/en.json";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
} from "react";

interface I18nCtx {
  t: (key: string, values?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nCtx | undefined>(undefined);

function resolveByPath(obj: unknown, path: string): string | undefined {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return typeof cur === "string" ? cur : undefined;
}

export function resolveTranslation(key: string): string {
  return resolveByPath(en, key) ?? `[${key}]`;
}

function interpolate(
  template: string,
  values?: Record<string, string | number>,
): string {
  if (!values) return template;
  let out = template;
  for (const [k, v] of Object.entries(values)) {
    out = out.split(`{${k}}`).join(String(v));
  }
  return out;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const t = useCallback<I18nCtx["t"]>(
    (key, values) => interpolate(resolveTranslation(key), values),
    [],
  );

  const value = useMemo<I18nCtx>(
    () => ({ t }),
    [t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useT must be used inside an <I18nProvider>");
  }
  return ctx;
}
