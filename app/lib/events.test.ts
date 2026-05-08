import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "../db/client";
import { events } from "../db/schema";
import { logLinkClick, logPageView } from "./events";

describe("logPageView", () => {
  const db = getDb(env.DB);

  beforeEach(async () => {
    await db.delete(events);
  });

  it("inserts a page_view event with the given source", async () => {
    const request = new Request("https://example.com/instagram");

    await logPageView({ db, source: "instagram", rawPath: "", request });

    const rows = await db.select().from(events);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: "page_view",
      source: "instagram",
      rawPath: null,
      clickedSlug: null,
    });
  });

  it("captures country, user_agent and referrer from request headers", async () => {
    const request = new Request("https://example.com/", {
      headers: {
        "cf-ipcountry": "AR",
        "user-agent": "Mozilla/5.0 (test)",
        referer: "https://t.co/abc",
      },
    });

    await logPageView({ db, source: "direct", rawPath: "", request });

    const [row] = await db.select().from(events);
    expect(row.country).toBe("AR");
    expect(row.userAgent).toBe("Mozilla/5.0 (test)");
    expect(row.referrer).toBe("https://t.co/abc");
  });

  it("stores missing headers as null, not empty strings", async () => {
    const request = new Request("https://example.com/");

    await logPageView({ db, source: "direct", rawPath: "", request });

    const [row] = await db.select().from(events);
    expect(row.country).toBeNull();
    expect(row.userAgent).toBeNull();
    expect(row.referrer).toBeNull();
  });

  it("stores raw_path when provided (unmatched slug case)", async () => {
    const request = new Request("https://example.com/whatever");

    await logPageView({
      db,
      source: "direct",
      rawPath: "whatever",
      request,
    });

    const [row] = await db.select().from(events);
    expect(row.source).toBe("direct");
    expect(row.rawPath).toBe("whatever");
  });
});

describe("logLinkClick", () => {
  const db = getDb(env.DB);

  beforeEach(async () => {
    await db.delete(events);
  });

  it("inserts a link_click event with clickedSlug and source", async () => {
    const request = new Request("https://example.com/out/spotify?source=instagram");

    await logLinkClick({
      db,
      clickedSlug: "spotify",
      source: "instagram",
      request,
    });

    const rows = await db.select().from(events);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: "link_click",
      source: "instagram",
      clickedSlug: "spotify",
      rawPath: null,
    });
  });

  it("captures country, user_agent and referrer headers", async () => {
    const request = new Request("https://example.com/out/youtube?source=direct", {
      headers: {
        "cf-ipcountry": "AR",
        "user-agent": "Mozilla/5.0",
        referer: "https://link-in-bio.hyan.dev/instagram",
      },
    });

    await logLinkClick({
      db,
      clickedSlug: "youtube",
      source: "direct",
      request,
    });

    const [row] = await db.select().from(events);
    expect(row.country).toBe("AR");
    expect(row.userAgent).toBe("Mozilla/5.0");
    expect(row.referrer).toBe("https://link-in-bio.hyan.dev/instagram");
  });
});

