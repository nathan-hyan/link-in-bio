import { describe, expect, it } from "vitest";
import { resolveSource } from "./source-resolution";

describe("resolveSource", () => {
  const validSlugs = new Set(["instagram", "youtube", "spotify"]);

  it("returns direct with empty rawPath when no slug is provided", () => {
    expect(resolveSource(undefined, validSlugs)).toEqual({
      source: "direct",
      rawPath: "",
    });
  });

  it("treats empty string the same as undefined", () => {
    expect(resolveSource("", validSlugs)).toEqual({
      source: "direct",
      rawPath: "",
    });
  });

  it("returns the matching source when slug is in the whitelist", () => {
    expect(resolveSource("instagram", validSlugs)).toEqual({
      source: "instagram",
      rawPath: "",
    });
  });

  it("returns direct with the typed path when slug is unknown", () => {
    expect(resolveSource("whatever", validSlugs)).toEqual({
      source: "direct",
      rawPath: "whatever",
    });
  });
});
