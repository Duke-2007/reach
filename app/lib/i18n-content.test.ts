import { describe, expect, it } from "vitest";
import en from "@/i18n/en.json";
import { resolveTranslation } from "@/hooks/useT";

describe("translated generic insight and callout copy", () => {
  it("does not leave trait placeholders in generic insights", () => {
    for (const key of ["missed.higher_missed", "missed.higher_covered", "missed.similar"] as const) {
      const sentence = resolveTranslation(key)
        .replaceAll("{trait}", "female-headed households")
        .replaceAll("{missed}", "24%")
        .replaceAll("{covered}", "37%");
      expect(sentence).not.toContain("(trait)");
      expect(sentence).not.toContain("{trait}");
    }
  });

  it("does not append a second percent sign after formatted coverage", () => {
    for (const key of ["simulate.callout_gain_no_ruleB", "simulate.callout_gain_no_ruleC"] as const) {
      const sentence = resolveTranslation(key).replaceAll("{coverage}", "10.1%");
      expect(sentence).not.toContain("10.1%%");
    }
    expect(en.simulate.callout_gain_no_ruleB).not.toContain("{coverage}%");
  });
});
