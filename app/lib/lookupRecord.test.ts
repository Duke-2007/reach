import { describe, expect, it } from "vitest";
import type { SimulatorGrid } from "@/types/data-contract";
import { lookupRecord } from "./simulator";

const grid = {
  records: [
    { area: "national", rule: "A", budget_share: 0.12, actual_coverage: 0.12 },
    { area: "national", rule: "B", budget_share: 0.2 },
    { area: "Huye", rule: "B", budget_share: 0.2 },
  ],
} as SimulatorGrid;

describe("lookupRecord", () => {
  it("returns the area's sole observed record regardless of slider budget", () => {
    expect(lookupRecord(grid, "national", "A", 35)?.budget_share).toBe(0.12);
  });

  it("matches area, rule, and budget for simulated rules", () => {
    expect(lookupRecord(grid, "national", "B", 20)?.area).toBe("national");
    expect(lookupRecord(grid, "Huye", "B", 20)?.area).toBe("Huye");
    expect(lookupRecord(grid, "national", "B", 19)).toBeNull();
    expect(lookupRecord(grid, "national", "C", 20)).toBeNull();
  });
});
