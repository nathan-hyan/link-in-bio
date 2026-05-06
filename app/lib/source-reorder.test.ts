import { describe, expect, it } from "vitest";
import { reorderForSource } from "./source-reorder";

const link = (slug: string) => ({ slug, label: slug, position: 0 });

describe("reorderForSource", () => {
  it("returns the list unchanged when source is 'direct'", () => {
    const links = [link("instagram"), link("youtube"), link("spotify")];
    expect(reorderForSource(links, "direct").map((l) => l.slug)).toEqual([
      "instagram",
      "youtube",
      "spotify",
    ]);
  });

  it("returns the list unchanged when source does not match any link", () => {
    const links = [link("instagram"), link("youtube"), link("spotify")];
    expect(reorderForSource(links, "tiktok").map((l) => l.slug)).toEqual([
      "instagram",
      "youtube",
      "spotify",
    ]);
  });

  it("moves a matching first-position link to the end", () => {
    const links = [link("instagram"), link("youtube"), link("spotify")];
    expect(reorderForSource(links, "instagram").map((l) => l.slug)).toEqual([
      "youtube",
      "spotify",
      "instagram",
    ]);
  });

  it("moves a matching middle-position link to the end", () => {
    const links = [link("instagram"), link("youtube"), link("spotify")];
    expect(reorderForSource(links, "youtube").map((l) => l.slug)).toEqual([
      "instagram",
      "spotify",
      "youtube",
    ]);
  });

  it("leaves a matching last-position link in place", () => {
    const links = [link("instagram"), link("youtube"), link("spotify")];
    expect(reorderForSource(links, "spotify").map((l) => l.slug)).toEqual([
      "instagram",
      "youtube",
      "spotify",
    ]);
  });

  it("does not mutate the input array", () => {
    const links = [link("instagram"), link("youtube"), link("spotify")];
    const before = links.map((l) => l.slug);
    reorderForSource(links, "instagram");
    expect(links.map((l) => l.slug)).toEqual(before);
  });
});
