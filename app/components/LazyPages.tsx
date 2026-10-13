"use client";

import dynamic from "next/dynamic";
import type { DistrictGaps, Equity, ModelMetrics, Profiles, SimulatorGrid } from "@/types/data-contract";
import { LoadingStatus } from "@/components/LoadingStatus";

const LazyGapMapView = dynamic(() => import("@/components/GapMap"), {
  ssr: false,
  loading: () => <LoadingStatus />,
});
const LazyModelView = dynamic(() => import("@/components/ModelPage"), {
  ssr: false,
  loading: () => <LoadingStatus />,
});
const LazyMissedView = dynamic(() => import("@/components/MissedPage"), {
  ssr: false,
  loading: () => <LoadingStatus />,
});
const LazySimulatorView = dynamic(() => import("@/components/SimulatePage"), {
  ssr: false,
  loading: () => <LoadingStatus />,
});

export function LazyGapMap({ data }: { data: DistrictGaps }) {
  return <LazyGapMapView data={data} />;
}

export function LazyModelPage({ data }: { data: ModelMetrics }) {
  return <LazyModelView data={data} />;
}

export function LazyMissedPage({ data }: { data: Profiles }) {
  return <LazyMissedView data={data} />;
}

export function LazySimulatePage({ data, equity }: { data: SimulatorGrid; equity: Equity }) {
  return <LazySimulatorView data={data} equity={equity} />;
}
