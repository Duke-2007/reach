"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource } from "maplibre-gl";
import Link from "next/link";
import "maplibre-gl/dist/maplibre-gl.css";
import { useT } from "@/hooks/useT";
import type { DistrictGaps, DistrictRoute, DistrictRoutes, DistrictRow, RwandaMaskData } from "@/types/data-contract";
import { fitZoom, getRwandaMapLimits } from "@/lib/map-limits";
import {
  formatPercent,
  formatPercentWithCi,
  formatCount,
  formatRouteDistances,
} from "@/lib/format";

type LayerKey = "poverty_rate" | "exclusion_error" | "leakage" | "financial_access" | "triple_gap";

interface GeoJsonFeature {
  type: "Feature";
  properties: { shapeName: string; [key: string]: unknown };
  geometry: { type: "Polygon"; coordinates: number[][][] };
}

interface GeoJson {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
}

interface DistrictWithData extends DistrictRow {
  shapeName: string;
}

const LAYERS: LayerKey[] = ["poverty_rate", "exclusion_error", "leakage", "financial_access", "triple_gap"];
const ROAD_STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
const PLAIN_STYLE: maplibregl.StyleSpecification = { version: 8, sources: {}, layers: [] };

type BaseStyle = "plain" | "roads";

function layerKeyPart(layer: LayerKey): string {
  return layer.replace("_rate", "").replace("_error", "").replace("_financial_access", "financial").replace("_gap", "");
}

function withLayerValues(geoJson: GeoJson, districts: DistrictWithData[], layer: LayerKey): GeoJson {
  const values = new Map(districts.map((district) => [district.shapeName, district[layer]]));
  return {
    type: "FeatureCollection",
    features: geoJson.features.map((feature) => ({
      ...feature,
      properties: { ...feature.properties, value: values.get(feature.properties.shapeName) ?? null },
    })),
  };
}

function emptyLineCollection() {
  return { type: "FeatureCollection", features: [] };
}

function lineCollection(coordinates: number[][]) {
  if (coordinates.length < 2) return emptyLineCollection();
  return {
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates },
    }],
  };
}

function addDistrictLayers(
  map: maplibregl.Map,
  geoJson: GeoJson,
  districts: DistrictWithData[],
  layer: LayerKey,
  fillOpacity: number,
) {
  const values = districts.map((district) => district[layer]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  map.addSource("districts", {
    type: "geojson",
    data: withLayerValues(geoJson, districts, layer) as never,
  });
  map.addLayer({
    id: "districts-fill",
    type: "fill",
    source: "districts",
    paint: {
      "fill-color": ["case", ["==", ["get", "value"], null], "#e5e7eb", ["interpolate", ["linear"], ["get", "value"], min, "#e0e7ff", max, "#312e81"]],
      "fill-opacity": fillOpacity,
    },
  });
  map.addLayer({
    id: "districts-border",
    type: "line",
    source: "districts",
    paint: { "line-color": "#64748b", "line-width": 1 },
  });
  map.addSource("selected-road-route", { type: "geojson", data: emptyLineCollection() as never });
  map.addLayer({
    id: "selected-road-route-casing",
    type: "line",
    source: "selected-road-route",
    layout: { visibility: "none", "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#ffffff", "line-width": 3.5 },
  });
  map.addLayer({
    id: "selected-road-route-line",
    type: "line",
    source: "selected-road-route",
    layout: { visibility: "none", "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#123b6d", "line-width": 2 },
  });
  map.addSource("selected-straight-line", { type: "geojson", data: emptyLineCollection() as never });
  map.addLayer({
    id: "selected-straight-line-layer",
    type: "line",
    source: "selected-straight-line",
    layout: { visibility: "none" },
    paint: { "line-color": "#111827", "line-width": 1.5, "line-dasharray": [2, 2] },
  });
}

function selectedDistrictFeature(geoJson: GeoJson, district: DistrictWithData | null): GeoJsonFeature | undefined {
  if (!district) return undefined;
  return geoJson.features.find((feature) => feature.properties.shapeName === district.shapeName);
}

function getFeatureBounds(feature: GeoJsonFeature): maplibregl.LngLatBounds {
  const bounds = new maplibregl.LngLatBounds();
  feature.geometry.coordinates.forEach((ring) => {
    ring.forEach((coordinate) => bounds.extend(coordinate as [number, number]));
  });
  return bounds;
}

function addSelectedDistrictHighlight(map: maplibregl.Map) {
  map.addSource("selected-district-highlight", { type: "geojson", data: emptyLineCollection() as never });
  map.addLayer({
    id: "selected-district-highlight-line",
    type: "line",
    source: "selected-district-highlight",
    paint: { "line-color": "#0f172a", "line-width": 3 },
  });
}

function setSelectedDistrictHighlight(
  map: maplibregl.Map,
  geoJson: GeoJson,
  selected: DistrictWithData | null,
) {
  const highlightSource = map.getSource("selected-district-highlight") as GeoJSONSource | undefined;
  const feature = selectedDistrictFeature(geoJson, selected);
  highlightSource?.setData(feature
    ? { type: "FeatureCollection", features: [feature] } as never
    : emptyLineCollection() as never);
  if (map.getLayer("districts-border")) {
    map.setPaintProperty("districts-border", "line-color", selected ? "#cbd5e1" : "#64748b");
    map.setPaintProperty("districts-border", "line-width", selected ? 0.5 : 1);
  }
}

function addRwandaMask(map: maplibregl.Map, mask: RwandaMaskData) {
  const feature = mask.features.find((item) => item.properties.kind === "mask");
  if (!feature) throw new Error("Rwanda mask feature is missing");
  map.addSource("rwanda-mask", { type: "geojson", data: { type: "FeatureCollection", features: [feature] } as never });
  map.addLayer({
    id: "rwanda-mask-fill", type: "fill", source: "rwanda-mask",
    paint: { "fill-color": window.getComputedStyle(map.getContainer()).backgroundColor || "#f1f5f9", "fill-opacity": 1 },
  });
}

function addRwandaOutline(map: maplibregl.Map, mask: RwandaMaskData) {
  const feature = mask.features.find((item) => item.properties.kind === "outline");
  if (!feature) throw new Error("Rwanda outline feature is missing");
  map.addSource("rwanda-outline", { type: "geojson", data: { type: "FeatureCollection", features: [feature] } as never });
  map.addLayer({ id: "rwanda-outline-line", type: "line", source: "rwanda-outline", paint: { "line-color": "#1e293b", "line-width": 1.5 } });
}

function setSelectedLine(
  map: maplibregl.Map,
  selected: DistrictWithData | null,
  routes: DistrictRoutes | null,
) {
  const roadSource = map.getSource("selected-road-route") as GeoJSONSource | undefined;
  const straightSource = map.getSource("selected-straight-line") as GeoJSONSource | undefined;
  const routeData = selected ? routes?.routes[selected.district] : undefined;
  const centre = routeData?.centre;
  const roadCoordinates = routeData?.route;
  const hasRoadRoute = roadCoordinates != null && roadCoordinates.length >= 2;

  roadSource?.setData(hasRoadRoute ? lineCollection(roadCoordinates) as never : emptyLineCollection() as never);
  straightSource?.setData(!hasRoadRoute && routes && centre
    ? lineCollection([[routes.origin.lon, routes.origin.lat], centre]) as never
    : emptyLineCollection() as never);

  if (map.getLayer("selected-road-route-casing")) {
    map.setLayoutProperty("selected-road-route-casing", "visibility", hasRoadRoute ? "visible" : "none");
    map.setLayoutProperty("selected-road-route-line", "visibility", hasRoadRoute ? "visible" : "none");
    map.setLayoutProperty("selected-straight-line-layer", "visibility", selected && !hasRoadRoute && centre ? "visible" : "none");
  }
}

function fitToSelectedDistrict(
  map: maplibregl.Map,
  district: DistrictWithData,
  geoJson: GeoJson,
) {
  const feature = selectedDistrictFeature(geoJson, district);
  if (!feature) return;
  const bounds = getFeatureBounds(feature);
  if (bounds.isEmpty()) return;
  map.fitBounds(bounds, {
    padding: 40,
    maxZoom: 11,
    duration: 800,
  });
}

function makeAttributionControl(
  style: BaseStyle,
  translate: (key: string) => string,
): maplibregl.AttributionControl {
  return new maplibregl.AttributionControl({
    compact: true,
    ...(style === "roads" ? { customAttribution: translate("map.road_basemap_attribution") } : {}),
  });
}

export default function GapMap({ data }: { data: DistrictGaps }) {
  const { t } = useT();
  const mapContainer = useRef<HTMLDivElement>(null);
  const selectedCardRef = useRef<HTMLElement>(null);
  const resetMapViewRef = useRef<() => void>(() => undefined);
  const userMovedMapRef = useRef(false);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const selectedLabelMarkerRef = useRef<maplibregl.Marker | null>(null);
  const [selectedLayer, setSelectedLayer] = useState<LayerKey>("poverty_rate");
  const [selectedDistrict, setSelectedDistrict] = useState<DistrictWithData | null>(null);
  const [geoJson, setGeoJson] = useState<GeoJson | null>(null);
  const [routes, setRoutes] = useState<DistrictRoutes | null>(null);
  const [rwandaMask, setRwandaMask] = useState<RwandaMaskData | null>(null);
  const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [showRoads, setShowRoads] = useState(false);
  const [roadMapUnavailable, setRoadMapUnavailable] = useState(false);
  const [styleRevision, setStyleRevision] = useState(0);
  const [districtsWithData, setDistrictsWithData] = useState<DistrictWithData[]>([]);
  const [mismatch, setMismatch] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const roadStyleCache = useRef<ReturnType<maplibregl.Map["getStyle"]> | null>(null);
  const activeBaseStyle = useRef<BaseStyle>("plain");
  const requestedBaseStyle = useRef<BaseStyle>("plain");
  const pendingBaseStyle = useRef<BaseStyle | null>(null);
  const roadStyleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapHasLoaded = useRef(false);
  const attributionControlRef = useRef<maplibregl.AttributionControl | null>(null);
  const fallbackRoadStyleRef = useRef<() => void>(() => undefined);
  const viewStateRef = useRef({ selectedLayer, selectedDistrict, showRoads, t });

  useEffect(() => {
    viewStateRef.current = { selectedLayer, selectedDistrict, showRoads, t };
  }, [selectedLayer, selectedDistrict, showRoads, t]);

  useEffect(() => {
    let cancelled = false;
    async function loadMapData() {
      try {
        const [geoResponse, routesResponse, maskResponse] = await Promise.all([
          fetch("/data/districts.geojson"),
          fetch("/data/district_routes.json"),
          fetch("/data/rwanda_mask.geojson"),
        ]);
        if (!geoResponse.ok) throw new Error(`HTTP ${geoResponse.status}`);
        if (!maskResponse.ok) throw new Error(`HTTP ${maskResponse.status}`);
        const geo: GeoJson = await geoResponse.json();
        const mask: RwandaMaskData = await maskResponse.json();
        getRwandaMapLimits(mask);
        if (!cancelled) setRwandaMask(mask);
        if (routesResponse.ok) {
          const routeData: DistrictRoutes = await routesResponse.json();
          if (!cancelled) setRoutes(routeData);
        }
        if (cancelled) return;
        if (!geo.features.length || !data.districts.length) {
          setMapStatus("empty");
          return;
        }
        setGeoJson(geo);

        const dataMap = new Map(data.districts.map((district) => [district.district.toLowerCase().trim(), district]));
        const geoNames = new Set(geo.features.map((feature) => feature.properties.shapeName.toLowerCase().trim()));
        const onlyInData = data.districts.filter((district) => !geoNames.has(district.district.toLowerCase().trim())).map((district) => district.district);
        const onlyInGeo = geo.features.filter((feature) => !dataMap.has(feature.properties.shapeName.toLowerCase().trim())).map((feature) => feature.properties.shapeName);
        const allMismatches = [...onlyInData, ...onlyInGeo];
        if (allMismatches.length) {
          setMismatch(allMismatches);
          console.warn("District name mismatch:", allMismatches);
        }

        const matched = geo.features.flatMap((feature) => {
          const district = dataMap.get(feature.properties.shapeName.toLowerCase().trim());
          return district ? [{ ...district, shapeName: feature.properties.shapeName }] : [];
        });
        setDistrictsWithData(matched);
        if (!matched.length) setMapStatus("empty");
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load map data:", err);
          setMapStatus("error");
        }
      }
    }
    void loadMapData();
    return () => { cancelled = true; };
  }, [data]);

  useEffect(() => {
    if (!mapContainer.current || !geoJson || !rwandaMask || districtsWithData.length === 0) return;

    let cancelled = false;
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: PLAIN_STYLE,
      center: routes ? [routes.origin.lon, routes.origin.lat] : [29.9, -2.0],
      zoom: 7,
      minZoom: 4,
      maxZoom: 17,
      maxBounds: getRwandaMapLimits(rwandaMask).maxBounds,
      attributionControl: false,
    });
    mapRef.current = map;
    mapHasLoaded.current = false;
    activeBaseStyle.current = "plain";
    requestedBaseStyle.current = "plain";
    pendingBaseStyle.current = null;

    const removeCustomStyleLayers = () => {
      ["selected-district-highlight-line", "selected-road-route-line", "selected-road-route-casing", "selected-straight-line-layer", "rwanda-outline-line", "districts-border", "districts-fill", "rwanda-mask-fill"].forEach((id) => {
        if (map.getLayer(id)) map.removeLayer(id);
      });
      ["selected-district-highlight", "selected-road-route", "selected-straight-line", "districts", "rwanda-outline", "rwanda-mask"].forEach((id) => {
        if (map.getSource(id)) map.removeSource(id);
      });
    };

    const installDistrictContent = () => {
      if (cancelled) return;
      removeCustomStyleLayers();
      const view = viewStateRef.current;
      addRwandaMask(map, rwandaMask);
      addDistrictLayers(map, geoJson, districtsWithData, view.selectedLayer, view.showRoads ? 0.55 : 0.8);
      addRwandaOutline(map, rwandaMask);
      addSelectedDistrictHighlight(map);
      setSelectedLine(map, view.selectedDistrict, routes);
      setSelectedDistrictHighlight(map, geoJson, view.selectedDistrict);
      if (attributionControlRef.current) map.removeControl(attributionControlRef.current);
      attributionControlRef.current = makeAttributionControl(activeBaseStyle.current, view.t);
      map.addControl(attributionControlRef.current, "bottom-right");
      setMapStatus("ready");
      setStyleRevision((revision) => revision + 1);
      map.resize();
      updateMapLimits();
      if (view.selectedDistrict) fitToSelectedDistrict(map, view.selectedDistrict, geoJson);
      else if (!userMovedMapRef.current) fitWholeRwanda(true);
    };
    const updateMapLimits = () => {
      const bounds = getRwandaMapLimits(rwandaMask).maxBounds;
      map.setMaxBounds(bounds);
      const { clientWidth: width, clientHeight: height } = map.getContainer();
      if (width <= 0 || height <= 0) return;
      const padding = width < 640 ? 16 : 24;
      const zoom = fitZoom(rwandaMask.bbox, width, height, padding);
      map.setMinZoom(Math.max(0, Math.min(zoom, zoom - 0.3)));
    };
    const fitWholeRwanda = (animate = true) => {
      map.resize();
      updateMapLimits();
      const [west, south, east, north] = rwandaMask.bbox;
      map.fitBounds([[west, south], [east, north]], {
        padding: map.getContainer().clientWidth < 640 ? 16 : 24,
        maxZoom: 9,
        animate,
      });
    };
    const resetMapView = () => {
      userMovedMapRef.current = false;
      fitWholeRwanda(true);
    };
    resetMapViewRef.current = resetMapView;

    const fallbackToPlainStyle = () => {
      if (pendingBaseStyle.current !== "roads") return;
      if (roadStyleTimer.current) clearTimeout(roadStyleTimer.current);
      roadStyleTimer.current = null;
      requestedBaseStyle.current = "plain";
      pendingBaseStyle.current = "plain";
      setRoadMapUnavailable(true);
      setShowRoads(false);
      try {
        map.setStyle(PLAIN_STYLE, { diff: false });
      } catch {
        pendingBaseStyle.current = null;
        setMapStatus("error");
      }
    };
    fallbackRoadStyleRef.current = fallbackToPlainStyle;

    map.on("load", () => {
      if (cancelled) return;
      mapHasLoaded.current = true;
      activeBaseStyle.current = "plain";
      requestedBaseStyle.current = "plain";
      installDistrictContent();
    });
    map.on("style.load", () => {
      if (cancelled || !mapHasLoaded.current) return;
      const completedStyle = pendingBaseStyle.current ?? requestedBaseStyle.current;
      activeBaseStyle.current = completedStyle;
      if (completedStyle === "roads") roadStyleCache.current = map.getStyle();
      pendingBaseStyle.current = null;
      if (roadStyleTimer.current) clearTimeout(roadStyleTimer.current);
      roadStyleTimer.current = null;
      installDistrictContent();
    });
    map.on("movestart", (event) => {
      if (event.originalEvent) userMovedMapRef.current = true;
    });
    map.on("click", (event) => {
      if (!map.getLayer("districts-fill")) return;
      const feature = map.queryRenderedFeatures(event.point, { layers: ["districts-fill"] })[0];
      const shapeName = feature?.properties?.shapeName as string | undefined;
      const district = shapeName && districtsWithData.find((item) => item.shapeName === shapeName);
      if (district) {
        setSelectedDistrict(district);
        setSearch(district.shapeName);
        setSearchOpen(false);
        setActiveSuggestion(0);
        fitToSelectedDistrict(map, district, geoJson);
      }
    });
    map.on("mousemove", (event) => {
      const hasDistrict = map.getLayer("districts-fill") && map.queryRenderedFeatures(event.point, { layers: ["districts-fill"] }).length > 0;
      map.getCanvas().style.cursor = hasDistrict ? "pointer" : "";
    });
    map.on("error", () => {
      if (pendingBaseStyle.current === "roads" && !map.isStyleLoaded()) fallbackToPlainStyle();
    });
    const resizeObserver = new ResizeObserver(() => {
      map.resize();
      updateMapLimits();
      if (!userMovedMapRef.current && mapHasLoaded.current) fitWholeRwanda(true);
    });
    resizeObserver.observe(mapContainer.current);

    mapRef.current = map;
    return () => {
      cancelled = true;
      resizeObserver.disconnect();
      if (roadStyleTimer.current) clearTimeout(roadStyleTimer.current);
      roadStyleTimer.current = null;
      attributionControlRef.current = null;
      selectedLabelMarkerRef.current?.remove();
      selectedLabelMarkerRef.current = null;
      fallbackRoadStyleRef.current = () => undefined;
      resetMapViewRef.current = () => undefined;
      map.remove();
      mapRef.current = null;
      mapHasLoaded.current = false;
    };
  }, [geoJson, districtsWithData, routes, rwandaMask]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || mapStatus !== "ready") return;
    if (attributionControlRef.current) map.removeControl(attributionControlRef.current);
    attributionControlRef.current = makeAttributionControl(activeBaseStyle.current, t);
    map.addControl(attributionControlRef.current, "bottom-right");
  }, [t, mapStatus, styleRevision]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || mapStatus !== "ready" || !mapHasLoaded.current) return;
    const target: BaseStyle = showRoads ? "roads" : "plain";
    if (pendingBaseStyle.current === target) return;
    if (activeBaseStyle.current === target && map.isStyleLoaded()) return;

    if (roadStyleTimer.current) clearTimeout(roadStyleTimer.current);
    requestedBaseStyle.current = target;
    pendingBaseStyle.current = target;

    try {
      if (target === "roads") {
        roadStyleTimer.current = setTimeout(() => fallbackRoadStyleRef.current(), 15000);
        map.setStyle(roadStyleCache.current ?? ROAD_STYLE_URL, { diff: false });
      } else {
        map.setStyle(PLAIN_STYLE, { diff: false });
      }
    } catch {
      if (target === "roads") fallbackRoadStyleRef.current();
      else {
        pendingBaseStyle.current = null;
        queueMicrotask(() => setMapStatus("error"));
      }
    }
  }, [showRoads, mapStatus]);

  const rankedDistricts = useMemo(
    () => [...districtsWithData].sort((a, b) => b[selectedLayer] - a[selectedLayer]).slice(0, 10),
    [districtsWithData, selectedLayer],
  );

  useEffect(() => {
    const map = mapRef.current;
    if (!map || mapStatus !== "ready" || !geoJson) return;
    const source = map.getSource("districts") as GeoJSONSource | undefined;
    source?.setData(withLayerValues(geoJson, districtsWithData, selectedLayer) as never);
    if (!map.getLayer("districts-fill")) return;
    const values = districtsWithData.map((district) => district[selectedLayer]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    map.setPaintProperty("districts-fill", "fill-color", [
      "case", ["==", ["get", "value"], null], "#e5e7eb",
      ["interpolate", ["linear"], ["get", "value"], min, "#e0e7ff", max, "#312e81"],
    ]);
    map.setPaintProperty("districts-fill", "fill-opacity", showRoads ? 0.55 : 0.8);
  }, [selectedLayer, mapStatus, geoJson, districtsWithData, showRoads, styleRevision]);

  useEffect(() => {
    const map = mapRef.current;
    if (map) {
      setSelectedLine(map, selectedDistrict, routes);
      if (geoJson) setSelectedDistrictHighlight(map, geoJson, selectedDistrict);
    }
  }, [selectedDistrict, routes, geoJson, mapStatus, styleRevision]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || mapStatus !== "ready" || !geoJson) return;
    if (!selectedDistrict) {
      selectedLabelMarkerRef.current?.remove();
      selectedLabelMarkerRef.current = null;
      return;
    }
    const feature = selectedDistrictFeature(geoJson, selectedDistrict);
    if (!feature) return;
    const routeCentre = routes?.routes[selectedDistrict.district]?.centre;
    const position = routeCentre ?? getFeatureBounds(feature).getCenter().toArray();
    let element = selectedLabelMarkerRef.current?.getElement();
    if (!element) {
      element = document.createElement("div");
      element.setAttribute("role", "status");
      element.style.pointerEvents = "none";
      element.style.maxWidth = "min(70vw, 16rem)";
      element.style.overflow = "hidden";
      element.style.textOverflow = "ellipsis";
      element.style.whiteSpace = "nowrap";
      element.style.border = "1px solid rgba(15, 23, 42, 0.25)";
      element.style.borderRadius = "0.375rem";
      element.style.background = "rgba(255, 255, 255, 0.94)";
      element.style.padding = "0.25rem 0.5rem";
      element.style.color = "#0f172a";
      element.style.fontSize = "0.75rem";
      element.style.fontWeight = "600";
      element.style.boxShadow = "0 1px 3px rgba(15, 23, 42, 0.25)";
      selectedLabelMarkerRef.current = new maplibregl.Marker({ element, anchor: "center" });
    }
    element.textContent = selectedDistrict.shapeName;
    element.setAttribute("aria-label", selectedDistrict.shapeName);
    const marker = selectedLabelMarkerRef.current;
    if (!marker) return;
    marker.setLngLat(position).addTo(map);
  }, [selectedDistrict, routes, geoJson, mapStatus, styleRevision]);

  const suggestions = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return [];
    return districtsWithData.filter((district) => district.shapeName.toLocaleLowerCase().includes(query)).slice(0, 8);
  }, [districtsWithData, search]);

  const selectDistrict = (district: DistrictWithData) => {
    setSelectedDistrict(district);
    setSearch(district.shapeName);
    setSearchOpen(false);
    setActiveSuggestion(0);
    if (mapRef.current && geoJson) fitToSelectedDistrict(mapRef.current, district, geoJson);
  };

  useEffect(() => {
    if (!selectedDistrict || !selectedCardRef.current) return;
    if (!window.matchMedia("(max-width: 1023px)").matches) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    selectedCardRef.current.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "nearest" });
  }, [selectedDistrict]);

  const national = data.national_averages[selectedLayer] * 100;
  const values = districtsWithData.map((district) => district[selectedLayer] * 100);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;
  const takeaway = t(`map.takeaway_${layerKeyPart(selectedLayer)}`, { national: Math.round(national), min: Math.round(min), max: Math.round(max) });

  const indicatorTiles = [
    { label: t("map.card_poverty"), value: selectedDistrict?.poverty_rate ?? data.national_averages.poverty_rate, ci: selectedDistrict?.poverty_ci },
    { label: t("map.card_exclusion"), value: selectedDistrict?.exclusion_error ?? data.national_averages.exclusion_error, ci: selectedDistrict?.exclusion_error_ci },
    { label: t("map.card_leakage"), value: selectedDistrict?.leakage ?? data.national_averages.leakage, ci: selectedDistrict?.leakage_ci },
    { label: t("map.card_access"), value: selectedDistrict?.financial_access ?? data.national_averages.financial_access, ci: selectedDistrict?.financial_access_ci },
    { label: t("map.card_triple"), value: selectedDistrict?.triple_gap ?? data.national_averages.triple_gap, ci: selectedDistrict?.triple_gap_ci },
  ];
  const indicatorTilesGrid = <div className="grid min-w-0 grid-cols-2 gap-2">
    {indicatorTiles.map((tile, index) => <div key={tile.label} className={`min-w-0 ${index === 4 ? "col-span-2" : ""}`}>
      <MetricCard label={tile.label} value={tile.value} ci={tile.ci} smallCell={selectedDistrict?.small_cell} />
    </div>)}
  </div>;
  const selectedCard = selectedDistrict ? <section ref={selectedCardRef} aria-label={selectedDistrict.shapeName} className="w-full min-w-0 overflow-hidden rounded-xl border border-slate-300 bg-white p-4 shadow-lg dark:border-slate-700 dark:bg-slate-900 lg:rounded-md">
    <div className="mb-3 flex min-w-0 flex-wrap items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h3 className="min-w-0 break-words text-lg font-semibold text-slate-900 dark:text-slate-100">{selectedDistrict.shapeName}</h3>
          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-900 dark:bg-indigo-950 dark:text-indigo-100">{t("map.selected_badge")}</span>
          <button type="button" onClick={() => { setSelectedDistrict(null); setSearch(""); }} className="text-xs font-medium text-slate-600 underline hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">{t("map.clear_selection")}</button>
        </div>
        <p className="mt-1 break-words text-xs font-medium text-indigo-800 dark:text-indigo-200">{t("map.selected_indicator", { indicator: t(`map.layer_${layerKeyPart(selectedLayer)}`), value: formatPercent(selectedDistrict[selectedLayer]) })}</p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t("map.hover_households")}: {formatCount(selectedDistrict.n_households)}</p>
        {selectedDistrict.small_cell && <p className="mt-1 text-xs text-amber-900 dark:text-amber-100">{t("map.hover_small_sample")}</p>}
      </div>
    </div>
    {indicatorTilesGrid}
    <div className="mt-2 min-w-0 break-words rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-800">
      <h4 className="font-semibold text-slate-900 dark:text-slate-100">{t("map.distance_title")}</h4>
      {(() => {
        const route: DistrictRoute | undefined = routes?.routes[selectedDistrict.district];
        const distance = formatRouteDistances(route?.road_km, route?.duration_min, route?.straight_km);
        return <>
          {route?.road_km != null && <p className="mt-1 break-words text-slate-700 dark:text-slate-300">{t("map.road_distance", { distance: distance.roadKm, duration: distance.duration })}</p>}
          <p className="mt-1 break-words text-slate-700 dark:text-slate-300">{t("map.straight_distance", { distance: distance.straightKm })}</p>
          <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{t("map.distance_approximate")}</p>
          {route?.road_km != null && routes?.attribution && <p className="mt-2 break-words text-xs leading-relaxed text-slate-600 dark:text-slate-400">{t("map.route_attribution", { attribution: routes.attribution })}</p>}
        </>;
      })()}
    </div>
    <Link href={`/brief/${encodeURIComponent(selectedDistrict.district)}`} className="mt-3 inline-flex min-h-10 max-w-full items-center justify-center rounded-md bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700">{t("brief.open_brief")}</Link>
  </section> : <section ref={selectedCardRef} aria-label={t("map.overview_title")} className="w-full min-w-0 overflow-hidden rounded-xl border border-slate-300 bg-white p-4 shadow-lg dark:border-slate-700 dark:bg-slate-900 lg:rounded-md">
    <h3 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">{t("map.overview_title")}</h3>
    {indicatorTilesGrid}
    <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{t("map.select_district_hint")}</p>
  </section>;

  if (data.districts.length === 0) {
    return <p role="status" className="text-sm text-slate-700 dark:text-slate-300">{t("map.no_data")}</p>;
  }

  const searchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" && suggestions.length) {
      event.preventDefault();
      setSearchOpen(true);
      setActiveSuggestion((index) => (index + 1) % suggestions.length);
    } else if (event.key === "ArrowUp" && suggestions.length) {
      event.preventDefault();
      setSearchOpen(true);
      setActiveSuggestion((index) => (index - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === "Enter" && searchOpen && suggestions[activeSuggestion]) {
      event.preventDefault();
      selectDistrict(suggestions[activeSuggestion]);
    } else if (event.key === "Escape") {
      setSearchOpen(false);
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-4 px-4 pb-8 sm:px-6">
      {mismatch.length > 0 && <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-100">{t("map.mismatch_warning")}</div>}
      <p className="text-base leading-relaxed text-slate-700 dark:text-slate-300">{takeaway}</p>

      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,46fr)_minmax(0,32fr)_minmax(0,22fr)]">
        <section className="min-w-0 lg:col-start-1 lg:row-start-1">
          <div className="mb-3 flex flex-wrap gap-2">
            {LAYERS.map((layer) => {
              const label = t(`map.layer_${layerKeyPart(layer)}`);
              return <button key={layer} type="button" onClick={() => setSelectedLayer(layer)} aria-pressed={selectedLayer === layer} className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${selectedLayer === layer ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"}`}>{label}</button>;
            })}
          </div>

          <div className="relative w-full overflow-hidden rounded-md lg:w-[min(100%,88.14vh,791px)]">
            <div ref={mapContainer} role="region" aria-label={t("map.map_aria")} className="aspect-[1.1/1] w-full border border-slate-300 bg-slate-100 dark:border-slate-700 dark:bg-slate-900 lg:aspect-[1.13/1]" />
            <div className="absolute left-2 right-2 top-2 z-10 sm:left-3 sm:right-auto sm:w-72">
              <label htmlFor="district-search" className="sr-only">{t("map.search_district")}</label>
              <input
                id="district-search"
                type="search"
                role="combobox"
                aria-label={t("map.search_district")}
                aria-autocomplete="list"
                aria-expanded={searchOpen && search.trim().length > 0}
                aria-controls="district-search-results"
                aria-activedescendant={searchOpen && suggestions[activeSuggestion] ? `district-option-${activeSuggestion}` : undefined}
                placeholder={t("map.search_placeholder")}
                value={search}
                onChange={(event) => { setSearch(event.target.value); setSearchOpen(true); setActiveSuggestion(0); }}
                onFocus={() => setSearchOpen(true)}
                onBlur={() => window.setTimeout(() => setSearchOpen(false), 120)}
                onKeyDown={searchKeyDown}
                className="w-full rounded-md border border-slate-300 bg-white/95 px-3 py-2 text-sm text-slate-900 shadow-md outline-none focus:border-indigo-700 focus:ring-2 focus:ring-indigo-700/30 dark:border-slate-600 dark:bg-slate-950/95 dark:text-white"
              />
              {searchOpen && search.trim().length > 0 && <ul id="district-search-results" role="listbox" aria-label={t("map.search_results_aria")} className="mt-1 max-h-56 overflow-y-auto rounded-md border border-slate-300 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-950">
                {suggestions.length ? suggestions.map((district, index) => <li id={`district-option-${index}`} key={district.shapeName} role="option" aria-selected={activeSuggestion === index}>
                  <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => selectDistrict(district)} className={`w-full px-3 py-2 text-left text-sm text-slate-900 dark:text-slate-100 ${activeSuggestion === index ? "bg-indigo-50 dark:bg-slate-800" : "hover:bg-slate-100 dark:hover:bg-slate-800"}`}>{district.shapeName}</button>
                </li>) : <li className="px-3 py-2 text-sm text-slate-600 dark:text-slate-300">{t("map.search_no_results")}</li>}
              </ul>}
              <button
                type="button"
                role="switch"
                aria-label={t("map.show_roads")}
                aria-checked={showRoads}
                onClick={() => {
                  if (!showRoads) setRoadMapUnavailable(false);
                  setShowRoads((enabled) => !enabled);
                }}
                className="mt-2 inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-300 bg-white/95 px-3 py-1.5 text-sm font-medium text-slate-900 shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700 dark:border-slate-600 dark:bg-slate-950/95 dark:text-white"
              >
                <span aria-hidden="true" className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${showRoads ? "bg-indigo-700" : "bg-slate-400"}`}>
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${showRoads ? "translate-x-4" : "translate-x-0.5"}`} />
                </span>
                {t("map.show_roads")}
              </button>
            </div>
            {mapStatus === "loading" ? <p role="status" className="pointer-events-none absolute inset-0 grid place-items-center bg-slate-100/75 pt-12 text-sm text-slate-700 dark:bg-slate-900/75 dark:text-slate-300">{t("map.loading")}</p> : null}
            {mapStatus === "empty" ? <p role="status" className="pointer-events-none absolute inset-0 grid place-items-center bg-slate-100/75 p-4 pt-12 text-center text-sm text-slate-700 dark:bg-slate-900/75 dark:text-slate-300">{t("map.no_data")}</p> : null}
            {mapStatus === "error" ? <p role="alert" className="pointer-events-none absolute inset-0 grid place-items-center bg-slate-100/75 p-4 pt-12 text-center text-sm text-slate-700 dark:bg-slate-900/75 dark:text-slate-300">{t("map.geojson_error")}</p> : null}
            {roadMapUnavailable ? <p role="status" className="absolute bottom-2 left-2 z-10 max-w-[calc(100%-1rem)] rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-950 shadow dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">{t("map.road_map_unavailable")}</p> : null}
            <div className="absolute right-3 top-3 z-10 flex flex-col overflow-hidden rounded-md border border-slate-300 shadow dark:border-slate-600">
              <button type="button" aria-label={t("map.zoom_in")} onClick={() => { userMovedMapRef.current = true; mapRef.current?.zoomIn(); }} className="h-10 w-10 bg-white text-xl font-semibold text-slate-900 hover:bg-slate-100 dark:bg-slate-950 dark:text-white dark:hover:bg-slate-800">+</button>
              <button type="button" aria-label={t("map.zoom_out")} onClick={() => { userMovedMapRef.current = true; mapRef.current?.zoomOut(); }} className="h-10 w-10 border-t border-slate-300 bg-white text-xl font-semibold text-slate-900 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-950 dark:text-white dark:hover:bg-slate-800">−</button>
              <button type="button" onClick={() => resetMapViewRef.current()} className="border-t border-slate-300 bg-white px-2 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-950 dark:text-white dark:hover:bg-slate-800">{t("map.reset_view")}</button>
            </div>
          </div>

          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 text-sm text-slate-600 dark:text-slate-400">
            <span>{t("map.legend_low")}</span><div aria-hidden="true" className="h-2 min-w-16 max-w-64 flex-1 rounded bg-gradient-to-r from-indigo-100 to-indigo-900 dark:from-indigo-300 dark:to-indigo-950" /><span>{t("map.legend_high")}</span><span className="min-w-0 flex-1 break-words text-right text-xs font-medium">{t(`map.layer_${layerKeyPart(selectedLayer)}`)}</span>
          </div>

        </section>

        <aside className="order-4 flex min-w-0 flex-col gap-3 lg:order-none lg:col-start-2 lg:row-start-2 xl:col-start-3 xl:row-start-1 xl:sticky xl:top-20 xl:self-start">
          <div className="min-w-0">
            <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{t("map.ranking_title")}</h3>
            <ol className="space-y-1">
              {rankedDistricts.map((district, index) => {
                const indicator = t(`map.layer_${layerKeyPart(selectedLayer)}`);
                const value = formatPercent(district[selectedLayer]);
                return <li key={district.shapeName}>
                  <button type="button" onClick={() => selectDistrict(district)} aria-label={t("map.rank_entry", { rank: index + 1, district: district.shapeName, indicator, value })} aria-current={selectedDistrict?.shapeName === district.shapeName ? "true" : undefined} className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${selectedDistrict?.shapeName === district.shapeName ? "bg-slate-200 dark:bg-slate-800" : "hover:bg-slate-100 dark:hover:bg-slate-800/50"}`}>
                    <span className="font-medium text-slate-900 dark:text-slate-100">{index + 1}. {district.shapeName}</span><span className="ml-2 text-slate-600 dark:text-slate-400">{value}</span>
                  </button>
                </li>;
              })}
            </ol>
          </div>
        </aside>
        <div className="order-3 min-w-0 lg:order-none lg:col-start-2 lg:row-start-1 xl:col-start-2 xl:row-start-1">{selectedCard}</div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, ci, smallCell }: { label: string; value: number | null; ci?: [number, number]; smallCell?: boolean }) {
  return <div className="min-w-0 rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
    <p className="text-xs font-medium text-slate-600 dark:text-slate-400">{label}</p>
    <p className="mt-1 break-words text-base font-semibold text-slate-900 dark:text-slate-100">{formatPercentWithCi(value, ci, { smallCell })}</p>
  </div>;
}
