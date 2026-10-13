import { describe, expect, it } from "vitest";
import { resolveTranslation } from "./useT";

describe("resolveTranslation", () => {
  it("uses the English value without exposing the draft marker", () => {
    const value = resolveTranslation("rw", "nav.missed");
    expect(value).toBe("Missed vs covered");
    expect(value).not.toContain("TODO_TRANSLATE");
  });

  it("keeps completed Kinyarwanda values", () => {
    expect(resolveTranslation("rw", "nav.home")).toBe(
      "Ikarita y’uduce tutagerwaho n’ubufasha",
    );
  });
});
