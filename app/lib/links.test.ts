import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "../db/client";
import { links } from "../db/schema";
import { getEnabledLinks, getEnabledLinkBySlug } from "./links";

describe("getEnabledLinks", () => {
  const db = getDb(env.DB);

  beforeEach(async () => {
    await db.delete(links);
  });

  it("returns an empty array when there are no links", async () => {
    expect(await getEnabledLinks(db)).toEqual([]);
  });

  it("returns an empty array when all links are disabled", async () => {
    await db.insert(links).values([
      {
        slug: "instagram",
        label: "Instagram",
        url: "https://instagram.com/x",
        position: 1,
        enabled: false,
      },
      {
        slug: "youtube",
        label: "YouTube",
        url: "https://youtube.com/x",
        position: 2,
        enabled: false,
      },
    ]);
    expect(await getEnabledLinks(db)).toEqual([]);
  });

  it("returns only enabled links", async () => {
    await db.insert(links).values([
      {
        slug: "instagram",
        label: "Instagram",
        url: "https://instagram.com/x",
        position: 1,
        enabled: true,
      },
      {
        slug: "youtube",
        label: "YouTube",
        url: "https://youtube.com/x",
        position: 2,
        enabled: false,
      },
      {
        slug: "spotify",
        label: "Spotify",
        url: "https://spotify.com/x",
        position: 3,
        enabled: true,
      },
    ]);

    const result = await getEnabledLinks(db);
    expect(result.map((l) => l.slug)).toEqual(["instagram", "spotify"]);
  });

  it("returns enabled links sorted by position ascending", async () => {
    await db.insert(links).values([
      {
        slug: "spotify",
        label: "Spotify",
        url: "https://spotify.com/x",
        position: 5,
        enabled: true,
      },
      {
        slug: "instagram",
        label: "Instagram",
        url: "https://instagram.com/x",
        position: 1,
        enabled: true,
      },
      {
        slug: "youtube",
        label: "YouTube",
        url: "https://youtube.com/x",
        position: 3,
        enabled: true,
      },
    ]);

    const result = await getEnabledLinks(db);
    expect(result.map((l) => l.slug)).toEqual([
      "instagram",
      "youtube",
      "spotify",
    ]);
  });
});

describe("getEnabledLinkBySlug", () => {
  const db = getDb(env.DB);

  beforeEach(async () => {
    await db.delete(links);
  });

  it("returns null when slug does not exist", async () => {
    expect(await getEnabledLinkBySlug(db, "nope")).toBeNull();
  });

  it("returns null when slug exists but is disabled", async () => {
    await db.insert(links).values({
      slug: "instagram",
      label: "Instagram",
      url: "https://instagram.com/x",
      position: 1,
      enabled: false,
    });
    expect(await getEnabledLinkBySlug(db, "instagram")).toBeNull();
  });

  it("returns the link when slug exists and is enabled", async () => {
    await db.insert(links).values({
      slug: "spotify",
      label: "Spotify",
      url: "https://open.spotify.com/artist/x",
      position: 1,
      enabled: true,
    });

    const result = await getEnabledLinkBySlug(db, "spotify");
    expect(result).not.toBeNull();
    expect(result?.url).toBe("https://open.spotify.com/artist/x");
    expect(result?.label).toBe("Spotify");
  });
});
