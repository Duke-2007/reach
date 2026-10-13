import { describe, expect, it } from "vitest";
import { compareConfidenceIntervals, firstBriefRecommendation } from "./brief";

describe("firstBriefRecommendation", () => {
  it.each([
    [true, true, "action_screening_both"],
    [true, false, "action_screening_model"],
    [false, true, "action_screening_scorecard"],
    [false, false, "action_monitor"],
  ] as const)("selects the correct leading action", (model, scorecard, expected) => {
    expect(firstBriefRecommendation(model, scorecard)).toBe(expected);
  });
});

describe("compareConfidenceIntervals", () => {
  it("marks overlapping intervals unclear and separated intervals above/below", () => {
    expect(compareConfidenceIntervals([0.2, 0.4], [0.3, 0.5])).toBe("unclear");
    expect(compareConfidenceIntervals([0.6, 0.7], [0.3, 0.5])).toBe("above");
    expect(compareConfidenceIntervals([0.1, 0.2], [0.3, 0.5])).toBe("below");
  });
});
