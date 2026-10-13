"use client";

import en from "@/i18n/en.json";
import rw from "@/i18n/rw.json";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type Lang = "en" | "rw";

export type Dict = typeof en;

const DICTS: Record<Lang, Dict> = { en, rw };
const DEFAULT_LANG: Lang = "en";
const STORAGE_KEY = "reach.lang";

type Interpolate = (
  template: string,
  values?: Record<string, string | number>,
) => string;

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
  interpolate: Interpolate;
  dict: Dict;
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

export function resolveTranslation(lang: Lang, key: string): string {
  const fallback = resolveByPath(DICTS[DEFAULT_LANG], key) ?? `[${key}]`;
  const translated = resolveByPath(DICTS[lang], key) ?? fallback;
  const selected =
    lang === "rw" && translated.includes("TODO_TRANSLATE")
      ? fallback
      : translated;
  return selected.replaceAll("TODO_TRANSLATE", "");
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
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);

  useEffect(() => {
    let savedLang: Lang | null = null;
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "en" || saved === "rw") {
        savedLang = saved;
      }
    } catch {
      /* ignore */
    }
    if (!savedLang) {
      try {
        const nav = (window.navigator.language || "").toLowerCase();
        if (nav.startsWith("rw") || nav.startsWith("kin")) {
          savedLang = "rw";
        }
      } catch {
        /* ignore */
      }
    }
    if (savedLang && savedLang !== DEFAULT_LANG) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLangState(savedLang);
    }
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("lang", lang);
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore */
    }
  }, [lang]);

  const dict = DICTS[lang];

  const t = useCallback<I18nCtx["t"]>(
    (key, values) => {
      const str = resolveTranslation(lang, key);
      return interpolate(str, values);
    },
    [lang],
  );

  const value = useMemo<I18nCtx>(
    () => ({
      lang,
      setLang: (l) => setLangState(l),
      t,
      interpolate,
      dict,
    }),
    [lang, t, dict],
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
