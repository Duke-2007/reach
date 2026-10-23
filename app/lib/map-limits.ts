import type { GeoJsonBbox, MapBounds, RwandaMaskData } from "@/types/data-contract";

/** Extract the padded Rwanda camera bounds from the static mask GeoJSON. */
export function getRwandaMapLimits(mask: RwandaMaskData): { maxBounds: MapBounds } {
  const bounds = mask.properties?.max_bounds;
  if (
    !Array.isArray(bounds) || bounds.length !== 2 ||
    !bounds.every((point) => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite)) ||
    bounds[0][0] >= bounds[1][0] || bounds[0][1] >= bounds[1][1]
  ) {
    throw new Error("Rwanda mask must provide valid properties.max_bounds");
  }
  return { maxBounds: bounds as MapBounds };
}

function mercatorY(latitude: number): number {
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, latitude));
  const phi = clamped * Math.PI / 180;
  return (1 - Math.log(Math.tan(phi) + 1 / Math.cos(phi)) / Math.PI) / 2;
}

/** Return the Web Mercator zoom that fits the bbox inside a pixel viewport. */
export function fitZoom(bbox: GeoJsonBbox, widthPx: number, heightPx: number, paddingPx: number): number {
  const [west, south, east, north] = bbox;
  if (![west, south, east, north, widthPx, heightPx, paddingPx].every(Number.isFinite) ||
    east <= west || north <= south || widthPx <= paddingPx * 2 || heightPx <= paddingPx * 2) {
    throw new Error("A valid bbox and viewport are required to compute fit zoom");
  }
  const xFraction = (east - west) / 360;
  const yFraction = Math.abs(mercatorY(south) - mercatorY(north));
  return Math.log2(Math.min(
    (widthPx - 2 * paddingPx) / (xFraction * 512),
    (heightPx - 2 * paddingPx) / (yFraction * 512),
  ));
}
