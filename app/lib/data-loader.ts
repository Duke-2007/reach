import type {
  AllDataFiles,
  DistrictGaps,
  ModelMetrics,
  PlaceholderStatus,
  Profiles,
  SimulatorGrid,
} from "@/types/data-contract";

const IS_SERVER = typeof window === "undefined";
const BASE = "/data";

async function loadJsonBrowser<T>(name: string): Promise<T> {
  const res = await fetch(`${BASE}/${name}.json`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(
      `Failed to load ${name}.json: HTTP ${res.status} ${res.statusText}`,
    );
  }
  return (await res.json()) as T;
}

async function loadJsonServer<T>(name: string): Promise<T> {
  // Dynamic import so fs/promises & path are never bundled for the browser.
  const { readFile } = await import("node:fs/promises");
  const path = await import("node:path");
  const filePath = path.join(process.cwd(), "public", "data", `${name}.json`);
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch (err) {
    const cause = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to load ${name}.json (${filePath}): ${cause}`, {
      cause: err,
    });
  }
}

async function loadJson<T>(name: string): Promise<T> {
  if (IS_SERVER) {
    return loadJsonServer<T>(name);
  }
  return loadJsonBrowser<T>(name);
}

export async function loadDistrictGaps(): Promise<DistrictGaps> {
  return loadJson<DistrictGaps>("district_gaps");
}

export async function loadSimulatorGrid(): Promise<SimulatorGrid> {
  return loadJson<SimulatorGrid>("simulator_grid");
}

export async function loadProfiles(): Promise<Profiles> {
  return loadJson<Profiles>("profiles");
}

export async function loadModelMetrics(): Promise<ModelMetrics> {
  return loadJson<ModelMetrics>("model_metrics");
}

export async function loadAllData(): Promise<AllDataFiles> {
  const [district_gaps, simulator_grid, profiles, model_metrics] =
    await Promise.all([
      loadDistrictGaps(),
      loadSimulatorGrid(),
      loadProfiles(),
      loadModelMetrics(),
    ]);
  return { district_gaps, simulator_grid, profiles, model_metrics };
}

export function derivePlaceholderStatus(
  data: Partial<AllDataFiles>,
): PlaceholderStatus {
  const dg = !!data.district_gaps?.placeholder;
  const sg = !!data.simulator_grid?.placeholder;
  const pr = !!data.profiles?.placeholder;
  const mm = !!data.model_metrics?.placeholder;
  return {
    district_gaps: dg,
    simulator_grid: sg,
    profiles: pr,
    model_metrics: mm,
    any: dg || sg || pr || mm,
    notes: {
      district_gaps: data.district_gaps ? data.district_gaps.note : undefined,
      simulator_grid: data.simulator_grid
        ? data.simulator_grid.note
        : undefined,
      profiles: data.profiles ? data.profiles.note : undefined,
      model_metrics: data.model_metrics ? data.model_metrics.note : undefined,
    },
  };
}
