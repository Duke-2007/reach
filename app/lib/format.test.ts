import { describe, expect, it } from "vitest";
import { formatPercentInterval } from "./format";

describe("formatPercentInterval", () => {
  it("uses one decimal for the estimate and interval endpoints", () => {
    expect(formatPercentInterval(0.853, [0.84, 0.864])).toBe("85.3% (84.0%-86.4%)");
  });
  it("uses an en dash for a null estimate", () => {
    expect(formatPercentInterval(null, [0.1, 0.2])).toBe("—");
  });
});
