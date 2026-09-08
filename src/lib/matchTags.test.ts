import { describe, expect, it } from "vitest";
import { buildMatchTags } from "./matchTags";

describe("buildMatchTags", () => {
  it("combines shared industries then shared interests", () => {
    expect(buildMatchTags(["Fintech"], ["AI", "Design"])).toEqual(["Fintech", "AI", "Design"]);
  });

  it("caps the result at 3 by default", () => {
    expect(buildMatchTags(["A", "B"], ["C", "D", "E"])).toEqual(["A", "B", "C"]);
  });

  it("respects a custom cap", () => {
    expect(buildMatchTags(["A", "B", "C"], ["D"], 2)).toEqual(["A", "B"]);
  });

  it("de-duplicates case-insensitively, keeping the first occurrence", () => {
    expect(buildMatchTags(["AI Experience"], ["ai experience", "B2B SaaS"])).toEqual([
      "AI Experience",
      "B2B SaaS",
    ]);
  });

  it("drops blank and whitespace-only entries", () => {
    expect(buildMatchTags(["", "  ", "Fintech"], ["  "])).toEqual(["Fintech"]);
  });

  it("returns an empty array when there is nothing shared", () => {
    expect(buildMatchTags([], [])).toEqual([]);
  });
});
