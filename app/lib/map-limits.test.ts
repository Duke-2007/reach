import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fitZoom, getRwandaMapLimits } from "@/lib/map-limits";
import type { RwandaMaskData } from "@/types/data-contract";

describe("getRwandaMapLimits", () => {
  it("reads the padded bounds from the shipped Rwanda mask", () => {
    const mask = JSON.parse(readFileSync("public/data/rwanda_mask.geojson", "utf8")) as RwandaMaskData;
    expect(getRwandaMapLimits(mask)).toEqual({ maxBounds: [[28.612, -3.09], [31.15, -0.797]] });
  });

  it("rejects invalid bounds", () => {
    expect(() => getRwandaMapLimits({ properties: { max_bounds: [[1, 2], [0, 3]] } } as RwandaMaskData)).toThrow("valid properties.max_bounds");
  });
});

describe("fitZoom", () => {
  const mask = JSON.parse(readFileSync("public/data/rwanda_mask.geojson", "utf8")) as RwandaMaskData;
  const bbox = mask.bbox;

  it.each([
    [960, 700, 24, 8.00],
    [960, 418, 24, 7.18],
    [360, 420, 16, 6.82],
  ])("fits %sx%s with %s px padding at the expected zoom", (width, height, padding, expected) => {
    expect(Math.abs(fitZoom(bbox, width, height, padding) - expected)).toBeLessThanOrEqual(0.05);
  });

  it("keeps the full bbox inside the padded viewport at the returned zoom", () => {
    const width = 360;
    const height = 420;
    const padding = 16;
    const zoom = fitZoom(bbox, width, height, padding);
    const [, south, , north] = bbox;
    const xPixels = ((bbox[2] - bbox[0]) / 360) * 512 * 2 ** zoom;
    const yPixels = Math.abs(
      ((1 - Math.log(Math.tan(south * Math.PI / 180) + 1 / Math.cos(south * Math.PI / 180)) / Math.PI) / 2) -
      ((1 - Math.log(Math.tan(north * Math.PI / 180) + 1 / Math.cos(north * Math.PI / 180)) / Math.PI) / 2),
    ) * 512 * 2 ** zoom;
    expect(xPixels).toBeLessThanOrEqual(width - 2 * padding);
    expect(yPixels).toBeLessThanOrEqual(height - 2 * padding);
  });
});
