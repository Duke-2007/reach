"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { type Lang, useT } from "@/hooks/useT";

type Route = {
  href: string;
  key: "home" | "missed" | "model" | "simulate" | "brief";
  dynamic?: boolean;
};

const ROUTES: Route[] = [
  { href: "/", key: "home" },
  { href: "/missed", key: "missed" },
  { href: "/model", key: "model" },
  { href: "/simulate", key: "simulate" },
  { href: "/brief/national", key: "brief", dynamic: true },
];

function isActive(key: Route["key"], pathname: string | null): boolean {
  if (!pathname) return false;
  if (key === "home") return pathname === "/";
  if (key === "brief") return pathname === "/brief" || pathname.startsWith("/brief/");
  return pathname === `/${key}` || pathname.startsWith(`/${key}/`);
}

function LangSwitcher() {
  const { lang, setLang, t } = useT();
  const options: { code: Lang; label: string }[] = [
    { code: "en", label: "EN" },
    { code: "rw", label: "RW" },
  ];
  return (
    <div
      role="group"
      aria-label={t("lang.label")}
      className="inline-flex overflow-hidden rounded-lg border border-slate-300 text-sm font-medium text-slate-700 dark:border-slate-600 dark:text-slate-200"
    >
      {options.map((opt) => {
        const selected = opt.code === lang;
        return (
          <button
            key={opt.code}
            type="button"
            onClick={() => setLang(opt.code)}
            aria-pressed={selected}
            className={
              "px-2.5 py-1 transition-colors first:rounded-l-[7px] last:rounded-r-[7px] " +
              (selected
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                : "bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800")
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function HeaderNavInner({ district }: { district?: string }) {
  const pathname = usePathname();
  const { t } = useT();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 text-slate-900 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 dark:text-slate-100">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold tracking-tight"
          onClick={() => setOpen(false)}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="h-5 w-5 shrink-0 text-indigo-700 dark:text-indigo-300"
          >
            <path d="M3 3v18h18" />
            <path d="m7 14 4-4 4 3 5-7" />
          </svg>
          <span>
            Reach <span className="hidden font-normal opacity-60 sm:inline">— Rwanda targeting</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {ROUTES.map((r) => {
            const active = isActive(r.key, pathname);
            const href =
              r.key === "brief" && district ? `/brief/${district.toLowerCase()}` : r.href;
            return (
              <Link
                key={r.key}
                href={href}
                className={
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors " +
                  (active
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                    : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800")
                }
              >
                {t(`nav.${r.key}`)}
              </Link>
            );
          })}
          <div className="ml-2">
            <LangSwitcher />
          </div>
        </nav>

        <button
          type="button"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? t("nav.menu_close") : t("nav.menu_open")}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800 md:hidden"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="h-5 w-5"
          >
            {open ? (
              <>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </>
            ) : (
              <>
                <line x1="4" y1="7" x2="20" y2="7" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="17" x2="20" y2="17" />
              </>
            )}
          </svg>
        </button>
      </div>

      {open ? (
        <div
          id="mobile-nav"
          className="border-t border-slate-200 bg-white px-4 pb-4 pt-2 dark:border-slate-800 dark:bg-slate-950 md:hidden sm:px-6"
        >
          <nav aria-label="Primary (mobile)" className="flex flex-col gap-1">
            {ROUTES.map((r) => {
              const active = isActive(r.key, pathname);
              const href =
                r.key === "brief" && district ? `/brief/${district.toLowerCase()}` : r.href;
              return (
                <Link
                  key={r.key}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={
                    "rounded-md px-3 py-2 text-base font-medium transition-colors " +
                    (active
                      ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                      : "text-slate-800 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800")
                  }
                >
                  {t(`nav.${r.key}`)}
                </Link>
              );
            })}
            <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-3 dark:border-slate-800">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                {t("lang.label")}
              </span>
              <LangSwitcher />
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}

export function HeaderNav({ district }: { district?: string }) {
  return <HeaderNavInner district={district} />;
}
