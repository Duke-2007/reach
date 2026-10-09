// Unit tests for simulator.ts pure functions.
import { describe, it, expect } from "vitest";

import type {
  Ci,
  SimulatorGrid,
  SimulatorRecord,
  SimulatorRecordA,
  SimulatorRecordBC,
} from "@/types/data-contract";
import {
  budgetPctToShare,
  buildScenarioCsvRows,
  formatCiForDisplay,
  formatNumber,
  getAreaRuleARecord,
  getAtObservedCoverage,
  lookupRecord,
  normalizeBudgetPct,
} from "./simulator";

const NATIONAL = "national";

function makeCi(lo: number, hi: number): Ci {
  return [lo, hi];
}

function makeFakeGrid(): SimulatorGrid {
  const records: SimulatorRecord[] = [];

  // Rule A — 1 record for national
  const ruleA: SimulatorRecordA = {
    area: NATIONAL,
    budget_share: 0.1006,
    rule: "A",
    rule_label: "Observed",
    poor_reached: 0.1473,
    poor_reached_ci: makeCi(0.1363, 0.1593),
    extreme_poor_reached: 0.1717,
    exclusion_error: 0.8527,
    leakage: 0.6574,
    cost_per_poor_reached: 2.919,
    actual_coverage: 0.1006,
  };
  records.push(ruleA);

  // Rule B — budgets 1%..3% for national
  for (let pct = 1; pct <= 3; pct++) {
    const share = pct / 100;
    const r: SimulatorRecordBC = {
      area: NATIONAL,
      budget_share: share,
      rule: "B",
      rule_label: "Model",
      poor_reached: 0.03 * pct,
      poor_reached_ci: makeCi(0.03 * pct - 0.002, 0.03 * pct + 0.002),
      extreme_poor_reached: 0.04 * pct,
      exclusion_error: 1 - 0.03 * pct,
      leakage: 0.2,
      cost_per_poor_reached: 1.2 + pct * 0.02,
    };
    records.push(r);
  }

  // Rule C — budget 2% for national
  const ruleC2: SimulatorRecordBC = {
    area: NATIONAL,
    budget_share: 0.02,
    rule: "C",
    rule_label: "Scorecard",
    poor_reached: 0.05,
    poor_reached_ci: makeCi(0.045, 0.055),
    extreme_poor_reached: 0.06,
    exclusion_error: 0.95,
    leakage: 0.25,
    cost_per_poor_reached: 1.4,
  };
  records.push(ruleC2);

  return {
    placeholder: false,
    note: "test grid",
    areas: [NATIONAL, "Bugesera"],
    rules: [
      { code: "A", label: "Observed" },
      { code: "B", label: "Model" },
      { code: "C", label: "Scorecard" },
    ],
    rule_A_note: "test",
    n_records: records.length,
    records,
    at_observed_coverage: [
      {
        area: NATIONAL,
        rule: "B",
        budget_share: 0.1006,
        poor_reached: 0.2804,
        poor_reached_ci: makeCi(0.269, 0.2909),
        observed_poor_reached: 0.1473,
        gain_per_1000_poor: 133.0554,
        gain_per_1000_poor_ci: makeCi(117.6636, 148.6153),
        clear_gain: true,
      },
      {
        area: NATIONAL,
        rule: "C",
        budget_share: 0.1006,
        poor_reached: 0.16,
        poor_reached_ci: makeCi(0.15, 0.17),
        observed_poor_reached: 0.1473,
        gain_per_1000_poor: 12.7,
        gain_per_1000_poor_ci: makeCi(-1.0, 26.0),
        clear_gain: false,
      },
    ],
    scorecard: {
      features: ["f1", "f2"],
      points: [
        { feature: "f1", band_or_code: "0", points: -2, description: "low" },
        { feature: "f1", band_or_code: "1", points: 3, description: "high" },
      ],
      note: "test note",
    },
  };
}

describe("simulator helpers", () => {
it("normalizeBudgetPct clamps and rounds", () => {
  expect(normalizeBudgetPct(0)).toBe(1);
  expect(normalizeBudgetPct(1)).toBe(1);
  expect(normalizeBudgetPct(12.3)).toBe(12);
  expect(normalizeBudgetPct(12.6)).toBe(13);
  expect(normalizeBudgetPct(77)).toBe(50);
  expect(normalizeBudgetPct(NaN)).toBe(1);
});

it("budgetPctToShare returns fraction", () => {
  expect(Math.abs(budgetPctToShare(1) - 0.01)).toBeLessThan(1e-9);
  expect(Math.abs(budgetPctToShare(50) - 0.5)).toBeLessThan(1e-9);
});

it("lookupRecord rule A ignores budgetPct and returns the single record", () => {
  const grid = makeFakeGrid();
  const r = lookupRecord(grid, NATIONAL, "A", 25);
  expect(r).toBeTruthy();
  expect(r?.rule).toBe("A");
  expect(r?.area).toBe(NATIONAL);
  expect(r?.budget_share).toBe(0.1006);
});

it("lookupRecord rule B finds budget by share", () => {
  const grid = makeFakeGrid();
  const r = lookupRecord(grid, NATIONAL, "B", 2);
  expect(r).toBeTruthy();
  expect(r?.rule).toBe("B");
  expect(Math.abs((r?.budget_share ?? 0) - 0.02)).toBeLessThan(1e-9);
});

it("lookupRecord returns null for missing area/rule/budget combo", () => {
  const grid = makeFakeGrid();
  expect(lookupRecord(grid, "Missing", "A", 1)).toBeNull();
  expect(lookupRecord(grid, NATIONAL, "B", 49)).toBeNull();
  expect(lookupRecord(grid, NATIONAL, "C", 1)).toBeNull();
});

it("lookupRecord handles empty/null grid gracefully", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect(lookupRecord(null as any, NATIONAL, "A", 1)).toBeNull();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect(lookupRecord({ records: [] } as any, NATIONAL, "A", 1)).toBeNull();
});

it("getAreaRuleARecord returns rule A or null", () => {
  const grid = makeFakeGrid();
  const a = getAreaRuleARecord(grid, NATIONAL);
  expect(a).toBeTruthy();
  expect(a?.actual_coverage).toBe(0.1006);
  expect(getAreaRuleARecord(grid, "Bugesera")).toBeNull();
});

it("getAtObservedCoverage returns matching entries", () => {
  const grid = makeFakeGrid();
  const b = getAtObservedCoverage(grid, NATIONAL, "B");
  expect(b).toBeTruthy();
  expect(b?.clear_gain).toBe(true);
  const c = getAtObservedCoverage(grid, NATIONAL, "C");
  expect(c).toBeTruthy();
  expect(c?.clear_gain).toBe(false);
  expect(getAtObservedCoverage(grid, "Bugesera", "B")).toBeNull();
});

it("formatNumber with null returns fallback", () => {
  expect(formatNumber(null, 2, "-")).toBe("-");
  expect(formatNumber(undefined, 2, "-")).toBe("-");
  expect(formatNumber(NaN, 2, "-")).toBe("-");
});

it("formatNumber rounds to digits", () => {
  expect(formatNumber(0.1473, 2, "-")).toBe("0.15");
  expect(formatNumber(1.005, 2, "-")).toBe(Number((1.005).toFixed(2)) === 1.01 ? "1.01" : (1.005).toFixed(2));
});

it("formatCiForDisplay returns empty string for invalid CI", () => {
  expect(formatCiForDisplay(null, false, 2)).toBe("");
  expect(formatCiForDisplay(undefined, false, 2)).toBe("");
  expect(formatCiForDisplay([1] as unknown as Ci, false, 2)).toBe("");
  expect(formatCiForDisplay([NaN, 0.5], false, 2)).toBe("");
});

it("formatCiForDisplay formats percent and numeric", () => {
  const ci: Ci = [0.102, 0.204];
  expect(formatCiForDisplay(ci, true, 1)).toBe("(10.2%–20.4%)");
  expect(formatCiForDisplay(ci, false, 3)).toBe("(0.102–0.204)");
});

it("buildScenarioCsvRows produces 2-column CSV with actual coverage only for rule A", () => {
  const grid = makeFakeGrid();
  const labels = {
    setting: "Setting",
    value: "Value",
    rowArea: "Area",
    rowRule: "Rule code",
    rowRuleLabel: "Rule label",
    rowBudget: "Budget share",
    rowPoor: "Share of poor reached",
    rowPoorLo: "Poor CI lower",
    rowPoorHi: "Poor CI upper",
    rowExtreme: "Extreme poor reached",
    rowExclusion: "Exclusion error",
    rowLeakage: "Leakage",
    rowCost: "Cost per poor",
    rowActual: "Actual coverage",
  };
  const csvA = buildScenarioCsvRows(grid, NATIONAL, "A", 1, labels);
  expect(csvA).toMatch(/^Setting,Value/);
  expect(csvA).toMatch(/Actual coverage,0\.100600/);

  const csvB = buildScenarioCsvRows(grid, NATIONAL, "B", 2, labels);
  expect(csvB).not.toMatch(/Actual coverage/);
  expect(csvB).toMatch(/^Setting,Value/);
  expect(csvB).toMatch(/(Rule code,B|"Rule code",B)/);
});
});
