import { describe, expect, it } from "vitest";
import { resolveTranslation } from "./useT";

describe("resolveTranslation", () => {
  it("returns the English value", () => {
    const value = resolveTranslation("nav.missed");
    expect(value).toBe("Missed vs covered");
  });

  it("shows a key marker when an English key is missing", () => {
    expect(resolveTranslation("missing.key")).toBe("[missing.key]");
  });
});
