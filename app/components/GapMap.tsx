"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource } from "maplibre-gl";
import Link from "next/link";
import "maplibre-gl/dist/maplibre-gl.css";
import { useT } from "@/hooks/useT";
import type { DistrictGaps, DistrictRow } from "@/types/data-contract";
import {
  formatPercent,
  formatPercentWithCi,
  formatCount,
} from "@/lib/format";

type LayerKey = "poverty_rate" | "exclusion_error" | "leakage" | "financial_access" | "triple_gap";

interface GeoJsonFeature {
  type: "Feature";
  properties: {
    shapeName: string;
    [key: string]: unknown;
  };
  geometry: {
    type: "Polygon";
    coordinates: number[][][];
  };
}

interface GeoJson {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
}

interface DistrictWithData extends DistrictRow {
  shapeName: string;
}

export default function GapMap({ data }: { data: DistrictGaps }) {
  const { t } = useT();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [selectedLayer, setSelectedLayer] = useState<LayerKey>("poverty_rate");
  const [selectedDistrict, setSelectedDistrict] = useState<DistrictWithData | null>(null);
  const [geoJson, setGeoJson] = useState<GeoJson | null>(null);
  const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [districtsWithData, setDistrictsWithData] = useState<DistrictWithData[]>([]);
  const [mismatch, setMismatch] = useState<string[]>([]);

  useEffect(() => {
    async function loadGeoJson() {
      try {
        const response = await fetch("/data/districts.geojson");
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const geo: GeoJson = await response.json();
        if (!geo.features.length || !data.districts.length) {
          setMapStatus("empty");
          return;
        }
        setGeoJson(geo);

        const dataMap = new Map(
          data.districts.map((d) => [d.district.toLowerCase().trim(), d]),
        );
        const geoNames = new Set(
          geo.features.map((f) => f.properties.shapeName.toLowerCase().trim()),
        );

        const onlyInData: string[] = [];
        const onlyInGeo: string[] = [];

        data.districts.forEach((d) => {
          const key = d.district.toLowerCase().trim();
          if (!geoNames.has(key)) onlyInData.push(d.district);
        });

        geo.features.forEach((f) => {
          const key = f.properties.shapeName.toLowerCase().trim();
          if (!dataMap.has(key)) onlyInGeo.push(f.properties.shapeName);
        });

        const allMismatches = [...onlyInData, ...onlyInGeo];
        if (allMismatches.length > 0) {
          setMismatch(allMismatches);
          console.warn("District name mismatch:", allMismatches);
        }

        const matched: DistrictWithData[] = [];
        geo.features.forEach((f) => {
          const key = f.properties.shapeName.toLowerCase().trim();
          const districtData = dataMap.get(key);
          if (districtData) {
            matched.push({ ...districtData, shapeName: f.properties.shapeName });
          }
        });

        setDistrictsWithData(matched);
        if (!matched.length) setMapStatus("empty");
      } catch (err) {
        console.error("Failed to load GeoJSON:", err);
        setMapStatus("error");
      }
    }

    loadGeoJson();
  }, [data]);

  useEffect(() => {
    if (!mapContainer.current || !geoJson || districtsWithData.length === 0) return;

    if (mapRef.current) {
      mapRef.current.remove();
    }

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {},
        layers: [],
      },
      center: [29.9, -2.0],
      zoom: 7,
      minZoom: 6,
      maxZoom: 10,
    });

    mapRef.current = map;

    map.on("load", () => {
      if (!geoJson) return;
      setMapStatus("ready");

      const dataValueMap = new Map(
        districtsWithData.map((d) => [d.shapeName, d[selectedLayer]]),
      );

      const min = Math.min(...districtsWithData.map((d) => d[selectedLayer]));
      const max = Math.max(...districtsWithData.map((d) => d[selectedLayer]));

      const featuresWithData = geoJson.features.map((f) => {
        const value = dataValueMap.get(f.properties.shapeName);
        return {
          ...f,
          properties: {
            ...f.properties,
            value: value ?? null,
          },
        };
      });

      const dataWithValues: GeoJson = {
        type: "FeatureCollection",
        features: featuresWithData,
      };

      map.addSource("districts", {
        type: "geojson",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: dataWithValues as any,
      });

      map.addLayer({
        id: "districts-fill",
        type: "fill",
        source: "districts",
        paint: {
          "fill-color": [
            "case",
            ["==", ["get", "value"], null],
            "#e5e7eb",
            [
              "interpolate",
              ["linear"],
              ["get", "value"],
              min,
              "#e0e7ff",
              max,
              "#312e81",
            ],
          ],
          "fill-opacity": 0.8,
        },
      });

      map.addLayer({
        id: "districts-border",
        type: "line",
        source: "districts",
        paint: {
          "line-color": "#64748b",
          "line-width": 1,
        },
      });

      map.on("click", "districts-fill", (e) => {
        if (e.features && e.features.length > 0) {
          const feature = e.features[0];
          const shapeName = feature.properties?.shapeName as string;
          const district = districtsWithData.find((d) => d.shapeName === shapeName);
          if (district) {
            setSelectedDistrict(district);
          }
        }
      });

      map.on("mousemove", "districts-fill", () => {
        map.getCanvas().style.cursor = "pointer";
      });

      map.on("mouseleave", "districts-fill", () => {
        map.getCanvas().style.cursor = "";
      });
    });
    map.on("error", () => setMapStatus("error"));

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [geoJson, districtsWithData, selectedLayer]);

  const handleLayerChange = (layer: LayerKey) => {
    setSelectedLayer(layer);
    if (mapRef.current && geoJson) {
      const dataValueMap = new Map(
        districtsWithData.map((d) => [d.shapeName, d[layer]]),
      );
      const min = Math.min(...districtsWithData.map((d) => d[layer]));
      const max = Math.max(...districtsWithData.map((d) => d[layer]));

      const featuresWithData = geoJson.features.map((f) => {
        const value = dataValueMap.get(f.properties.shapeName);
        return {
          ...f,
          properties: {
            ...f.properties,
            value: value ?? null,
          },
        };
      });

      const dataWithValues: GeoJson = {
        type: "FeatureCollection",
        features: featuresWithData,
      };

      const source = mapRef.current.getSource("districts") as GeoJSONSource | undefined;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      source?.setData(dataWithValues as any);

      mapRef.current.setPaintProperty("districts-fill", "fill-color", [
        "case",
        ["==", ["get", "value"], null],
        "#e5e7eb",
        [
          "interpolate",
          ["linear"],
          ["get", "value"],
          min,
          "#e0e7ff",
          max,
          "#312e81",
        ],
      ]);
    }
  };

  const handleRankingClick = (district: DistrictWithData) => {
    setSelectedDistrict(district);
    if (mapRef.current && geoJson) {
      const feature = geoJson.features.find((f) => f.properties.shapeName === district.shapeName);
      if (feature) {
        const coords = feature.geometry.coordinates[0][0];
        mapRef.current.flyTo({ center: [coords[0], coords[1]], zoom: 8 });
      }
    }
  };

  if (data.districts.length === 0) {
    return <p role="status" className="text-sm text-slate-700 dark:text-slate-300">{t("map.no_data")}</p>;
  }

  const topRanked = [...districtsWithData]
    .sort((a, b) => b[selectedLayer] - a[selectedLayer])
    .slice(0, 10);

  const national = data.national_averages[selectedLayer] * 100;
  const min = Math.min(...districtsWithData.map((d) => d[selectedLayer] * 100));
  const max = Math.max(...districtsWithData.map((d) => d[selectedLayer] * 100));

  const takeawayKey = `takeaway_${selectedLayer.replace("_rate", "").replace("_error", "").replace("_financial_access", "financial").replace("_gap", "")}` as keyof typeof t;
  const takeaway = t(`map.${takeawayKey}`, { national: Math.round(national), min: Math.round(min), max: Math.round(max) });

  return (
    <div className="flex flex-col gap-6">
      {mismatch.length > 0 && (
        <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-100">
          {t("map.mismatch_warning")}
        </div>
      )}

      <p className="text-base leading-relaxed text-slate-700 dark:text-slate-300">{takeaway}</p>

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="flex-1">
          <div className="mb-3 flex flex-wrap gap-2">
            {(["poverty_rate", "exclusion_error", "leakage", "financial_access", "triple_gap"] as LayerKey[]).map((layer) => (
              <button
                key={layer}
                type="button"
                onClick={() => handleLayerChange(layer)}
                aria-pressed={selectedLayer === layer}
                aria-label={t(`map.layer_${layer.replace("_rate", "").replace("_error", "").replace("_financial_access", "financial").replace("_gap", "")}`)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  selectedLayer === layer
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                }`}
              >
                {t(`map.layer_${layer.replace("_rate", "").replace("_error", "").replace("_financial_access", "financial").replace("_gap", "")}`)}
              </button>
            ))}
          </div>

          <div className="relative">
            <div ref={mapContainer} role="img" aria-label={t("map.map_aria")} className="h-[400px] w-full rounded-md border border-slate-300 bg-slate-100 dark:border-slate-700 dark:bg-slate-900" />
            {mapStatus === "loading" ? <p role="status" className="absolute inset-0 grid place-items-center rounded-md bg-slate-100 text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-300">{t("map.loading")}</p> : null}
            {mapStatus === "empty" ? <p role="status" className="absolute inset-0 grid place-items-center rounded-md bg-slate-100 p-4 text-center text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-300">{t("map.no_data")}</p> : null}
            {mapStatus === "error" ? <p role="alert" className="absolute inset-0 grid place-items-center rounded-md bg-slate-100 p-4 text-center text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-300">{t("map.geojson_error")}</p> : null}
          </div>

          <div className="mt-2 flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
            <span>{t("map.legend_low")}</span>
            <div className="h-2 w-32 rounded bg-gradient-to-r from-indigo-100 to-indigo-900 dark:from-indigo-300 dark:to-indigo-950" />
            <span>{t("map.legend_high")}</span>
          </div>
        </div>

        <div className="w-full lg:w-80">
          <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">{t("map.ranking_title")}</h3>
          <ul className="space-y-1">
            {topRanked.map((district, idx) => {
              const indicatorLabel = t(`map.layer_${selectedLayer.replace("_rate", "").replace("_error", "").replace("_financial_access", "financial").replace("_gap", "")}`);
              const indicatorValue = formatPercent(district[selectedLayer]);
              return (
                <li key={district.shapeName}>
                  <button
                    type="button"
                    onClick={() => handleRankingClick(district)}
                    aria-label={t("map.rank_entry", { rank: idx + 1, district: district.shapeName, indicator: indicatorLabel, value: indicatorValue })}
                    className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                      selectedDistrict?.shapeName === district.shapeName
                        ? "bg-slate-200 dark:bg-slate-800"
                        : "hover:bg-slate-100 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {idx + 1}. {district.shapeName}
                    </span>
                    <span className="ml-2 text-slate-600 dark:text-slate-400">
                      {indicatorValue}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {selectedDistrict && (
        <div className="rounded-md border border-slate-300 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-3 flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {selectedDistrict.shapeName}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {t("map.hover_households")}: {formatCount(selectedDistrict.n_households)}
              </p>
              <Link href={`/brief/${encodeURIComponent(selectedDistrict.district)}`} className="mt-1 inline-block text-sm font-medium text-indigo-700 underline dark:text-indigo-300">
                {t("brief.open_brief")}
              </Link>
            </div>
            {selectedDistrict.small_cell && (
              <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-100">
                {t("map.hover_small_sample")}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <MetricCard
              label={t("map.card_poverty")}
              value={selectedDistrict.poverty_rate}
              ci={selectedDistrict.poverty_ci}
              smallCell={selectedDistrict.small_cell}
            />
            <MetricCard
              label={t("map.card_exclusion")}
              value={selectedDistrict.exclusion_error}
              ci={selectedDistrict.exclusion_error_ci}
              smallCell={selectedDistrict.small_cell}
            />
            <MetricCard
              label={t("map.card_leakage")}
              value={selectedDistrict.leakage}
              ci={selectedDistrict.leakage_ci}
              smallCell={selectedDistrict.small_cell}
            />
            <MetricCard
              label={t("map.card_access")}
              value={selectedDistrict.financial_access}
              ci={selectedDistrict.financial_access_ci}
              smallCell={selectedDistrict.small_cell}
            />
            <MetricCard
              label={t("map.card_triple")}
              value={selectedDistrict.triple_gap}
              ci={selectedDistrict.triple_gap_ci}
              smallCell={selectedDistrict.small_cell}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  ci,
  smallCell,
}: {
  label: string;
  value: number;
  ci?: [number, number];
  smallCell?: boolean;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
      <p className="text-xs font-medium text-slate-600 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">
        {formatPercentWithCi(value, ci, { smallCell })}
      </p>
    </div>
  );
}
