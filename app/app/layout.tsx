import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

import { PlaceholderBanner } from "@/components/PlaceholderBanner";
import { HeaderNav } from "@/components/HeaderNav";
import { AppFooter } from "@/components/AppFooter";
import { I18nProvider } from "@/hooks/useT";
import {
  derivePlaceholderStatus,
  loadDistrictGaps,
  loadModelMetrics,
  loadProfiles,
  loadSimulatorGrid,
} from "@/lib/data-loader";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Reach — Rwanda targeting audit & simulator",
  description:
    "NISR 2026 Big Data Hackathon entry. Measure exclusion error and leakage by district, compare targeting rules under budget.",
};

async function PlaceholderDataBanner() {
  let status = undefined as
    | {
        kind: "ok";
        data: Parameters<typeof PlaceholderBanner>[0]["status"];
      }
    | { kind: "error"; message: string }
    | undefined;

  try {
    const [district_gaps, simulator_grid, profiles, model_metrics] =
      await Promise.all([
        loadDistrictGaps(),
        loadSimulatorGrid(),
        loadProfiles(),
        loadModelMetrics(),
      ]);
    status = {
      kind: "ok",
      data: derivePlaceholderStatus({
        district_gaps,
        simulator_grid,
        profiles,
        model_metrics,
      }),
    };
  } catch (err) {
    status = {
      kind: "error",
      message: err instanceof Error ? err.message : String(err),
    };
  }

  if (status.kind === "error") {
    return (
      <div
        role="alert"
        className="w-full border-b border-red-500/40 bg-red-50 px-4 py-3 text-sm text-red-950 dark:border-red-500/60 dark:bg-red-950/70 dark:text-red-100 sm:px-6"
      >
        <div className="mx-auto max-w-7xl">
          <p className="font-semibold">Could not load the data files.</p>
          <p className="mt-0.5 opacity-90">{status.message}</p>
        </div>
      </div>
    );
  }

  return <PlaceholderBanner status={status.data} />;
}

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground min-w-0">
        <I18nProvider>
          <PlaceholderDataBanner />
          <HeaderNav />
          <div className="flex min-h-0 flex-1 flex-col min-w-0">{children}</div>
          <AppFooter />
        </I18nProvider>
      </body>
    </html>
  );
}
