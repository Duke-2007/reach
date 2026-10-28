"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useT } from "@/hooks/useT";

type Route = {
  href: string;
  key: "home" | "missed" | "model" | "simulate" | "priority" | "brief";
};

const ROUTES: Route[] = [
  { href: "/", key: "home" },
  { href: "/missed", key: "missed" },
  { href: "/model", key: "model" },
  { href: "/simulate", key: "simulate" },
  { href: "/priority", key: "priority" },
  { href: "/brief", key: "brief" },
];

function isActive(key: Route["key"], pathname: string | null): boolean {
  if (!pathname) return false;
  if (key === "home") return pathname === "/";
  if (key === "brief") return pathname === "/brief" || pathname.startsWith("/brief/");
  return pathname === `/${key}` || pathname.startsWith(`/${key}/`);
}

function HeaderNavInner() {
  const pathname = usePathname();
  const { t } = useT();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 text-slate-900 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 dark:text-slate-100 min-w-0">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 min-w-0">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold tracking-tight transition-[color,background-color,border-color] duration-150 ease-smooth motion-reduce:transition-none min-w-0"
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
          <span className="truncate">
            Reach <span className="hidden font-normal opacity-60 lg:inline">— Rwanda targeting</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 2xl:flex min-w-0" aria-label="Primary">
          {ROUTES.map((r) => {
            const active = isActive(r.key, pathname);
            const href = r.href;
            return (
              <Link
                key={r.key}
                href={href}
                className={
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-[color,background-color,border-color] duration-150 ease-smooth motion-reduce:transition-none whitespace-nowrap " +
                  (active
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                    : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800")
                }
              >
                {t(`nav.${r.key}`)}
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? t("nav.menu_close") : t("nav.menu_open")}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800 2xl:hidden"
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
          className="border-t border-slate-200 bg-white px-4 pb-4 pt-2 motion-safe:animate-[mobile-menu-enter_150ms_var(--ease-out-fluid)_both] motion-reduce:animate-none dark:border-slate-800 dark:bg-slate-950 2xl:hidden sm:px-6 min-w-0"
        >
          <nav aria-label="Primary (mobile)" className="flex flex-col gap-1 min-w-0">
            {ROUTES.map((r) => {
              const active = isActive(r.key, pathname);
              const href = r.href;
              return (
                <Link
                  key={r.key}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={
                    "rounded-md px-3 py-2 text-base font-medium transition-[color,background-color,border-color] duration-150 ease-smooth motion-reduce:transition-none " +
                    (active
                      ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                      : "text-slate-800 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800")
                  }
                >
                  {t(`nav.${r.key}`)}
                </Link>
              );
            })}
          </nav>
        </div>
      ) : null}
    </header>
  );
}

export function HeaderNav() {
  return <HeaderNavInner />;
}
