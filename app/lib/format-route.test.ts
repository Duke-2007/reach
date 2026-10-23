import { describe, expect, it } from "vitest";
import { formatDuration, formatRouteDistances } from "./format";

describe("route distance and duration formatting", () => {
  it("formats road and straight distances to one decimal place", () => {
    expect(formatRouteDistances(48.44, 45, 35.06)).toEqual({
      roadKm: "48.4",
      duration: "45 min",
      straightKm: "35.1",
    });
  });

  it("formats durations in hours and minutes", () => {
    expect(formatDuration(80)).toBe("1 h 20 min");
    expect(formatDuration(120)).toBe("2 h");
  });

  it("uses an en dash for missing or non-finite values", () => {
    expect(formatRouteDistances(null, null, Number.NaN)).toEqual({
      roadKm: "—",
      duration: "—",
      straightKm: "—",
    });
  });
});
