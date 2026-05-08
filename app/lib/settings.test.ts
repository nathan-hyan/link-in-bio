import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "../db/client";
import { settings } from "../db/schema";
import {
  DEFAULT_BG_IMAGE_URL,
  SETTING_BG_IMAGE_URL,
  getBgImageUrl,
  getSetting,
  setSetting,
} from "./settings";

describe("getSetting / setSetting", () => {
  const db = getDb(env.DB);

  beforeEach(async () => {
    await db.delete(settings);
  });

  it("getSetting returns null when the key has never been set", async () => {
    expect(await getSetting(db, "missing_key")).toBeNull();
  });

  it("setSetting then getSetting roundtrips a value", async () => {
    await setSetting(db, "favorite_color", "blue");
    expect(await getSetting(db, "favorite_color")).toBe("blue");
  });

  it("setSetting overwrites an existing value (upsert)", async () => {
    await setSetting(db, "favorite_color", "blue");
    await setSetting(db, "favorite_color", "green");
    expect(await getSetting(db, "favorite_color")).toBe("green");
  });

  it("different keys are isolated", async () => {
    await setSetting(db, "a", "alpha");
    await setSetting(db, "b", "bravo");
    expect(await getSetting(db, "a")).toBe("alpha");
    expect(await getSetting(db, "b")).toBe("bravo");
  });
});

describe("getBgImageUrl", () => {
  const db = getDb(env.DB);

  beforeEach(async () => {
    await db.delete(settings);
  });

  it("returns the default when no bg setting is stored", async () => {
    expect(await getBgImageUrl(db)).toBe(DEFAULT_BG_IMAGE_URL);
  });

  it("returns the stored value when present", async () => {
    await setSetting(db, SETTING_BG_IMAGE_URL, "https://example.com/new-bg.jpg");
    expect(await getBgImageUrl(db)).toBe("https://example.com/new-bg.jpg");
  });

  it("falls back to the default if the stored value is an empty string", async () => {
    await setSetting(db, SETTING_BG_IMAGE_URL, "");
    expect(await getBgImageUrl(db)).toBe(DEFAULT_BG_IMAGE_URL);
  });
});
