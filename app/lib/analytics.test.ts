import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "../db/client";
import { events } from "../db/schema";
import {
  fillDailyGaps,
  getCountryCounts,
  getDailySeries,
  getDestinationCounts,
  getSourceCounts,
  getSourceDestinationMatrix,
  getTotals,
  parseDateRange,
  rangeToStartDate,
} from "./analytics";

const db = getDb(env.DB);

beforeEach(async () => {
  await db.delete(events);
});

async function insertPageView(opts: {
  source: string;
  rawPath?: string;
  country?: string | null;
  createdAt?: string;
}) {
  await db.insert(events).values({
    type: "page_view",
    source: opts.source,
    rawPath: opts.rawPath ?? null,
    clickedSlug: null,
    country: opts.country ?? null,
    userAgent: null,
    referrer: null,
    ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
  });
}

async function insertLinkClick(opts: {
  source: string;
  clickedSlug: string;
  country?: string | null;
  createdAt?: string;
}) {
  await db.insert(events).values({
    type: "link_click",
    source: opts.source,
    clickedSlug: opts.clickedSlug,
    rawPath: null,
    country: opts.country ?? null,
    userAgent: null,
    referrer: null,
    ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
  });
}

describe("parseDateRange", () => {
  it.each(["7d", "30d", "90d", "all"] as const)("accepts %s", (input) => {
    expect(parseDateRange(input)).toBe(input);
  });

  it("defaults to 30d for null", () => {
    expect(parseDateRange(null)).toBe("30d");
  });

  it("defaults to 30d for unknown input", () => {
    expect(parseDateRange("forever")).toBe("30d");
  });
});

describe("rangeToStartDate", () => {
  const now = new Date("2026-05-08T12:00:00Z");

  it("returns null for 'all'", () => {
    expect(rangeToStartDate("all", now)).toBeNull();
  });

  it("returns 7-days-ago for 7d", () => {
    expect(rangeToStartDate("7d", now)).toBe("2026-05-01");
  });

  it("returns 30-days-ago for 30d", () => {
    expect(rangeToStartDate("30d", now)).toBe("2026-04-08");
  });

  it("returns 90-days-ago for 90d", () => {
    expect(rangeToStartDate("90d", now)).toBe("2026-02-07");
  });
});

describe("getTotals", () => {
  it("returns zero when there are no events", async () => {
    expect(await getTotals(db, null)).toEqual({ pageViews: 0, linkClicks: 0 });
  });

  it("counts page_view and link_click events separately", async () => {
    await insertPageView({ source: "instagram" });
    await insertPageView({ source: "direct" });
    await insertLinkClick({ source: "instagram", clickedSlug: "spotify" });

    expect(await getTotals(db, null)).toEqual({ pageViews: 2, linkClicks: 1 });
  });

  it("filters by start date (inclusive)", async () => {
    await insertPageView({ source: "instagram", createdAt: "2026-04-01 10:00:00" });
    await insertPageView({ source: "instagram", createdAt: "2026-05-01 10:00:00" });

    expect(await getTotals(db, "2026-04-15")).toEqual({
      pageViews: 1,
      linkClicks: 0,
    });
  });
});

describe("getSourceCounts", () => {
  it("returns page_view counts grouped by source, sorted desc", async () => {
    await insertPageView({ source: "instagram" });
    await insertPageView({ source: "instagram" });
    await insertPageView({ source: "instagram" });
    await insertPageView({ source: "youtube" });
    await insertPageView({ source: "direct" });
    // link_clicks must NOT show up in source counts (different table semantic)
    await insertLinkClick({ source: "youtube", clickedSlug: "spotify" });

    const result = await getSourceCounts(db, null);
    expect(result).toEqual([
      { source: "instagram", count: 3 },
      { source: "youtube", count: 1 },
      { source: "direct", count: 1 },
    ]);
  });

  it("filters by start date", async () => {
    await insertPageView({ source: "instagram", createdAt: "2026-04-01 10:00:00" });
    await insertPageView({ source: "youtube", createdAt: "2026-05-01 10:00:00" });

    const result = await getSourceCounts(db, "2026-04-15");
    expect(result.map((r) => r.source)).toEqual(["youtube"]);
  });
});

describe("getDestinationCounts", () => {
  it("returns link_click counts grouped by clicked_slug, sorted desc", async () => {
    await insertLinkClick({ source: "instagram", clickedSlug: "spotify" });
    await insertLinkClick({ source: "instagram", clickedSlug: "spotify" });
    await insertLinkClick({ source: "direct", clickedSlug: "youtube" });
    // page_views must NOT show up
    await insertPageView({ source: "youtube" });

    const result = await getDestinationCounts(db, null);
    expect(result).toEqual([
      { slug: "spotify", count: 2 },
      { slug: "youtube", count: 1 },
    ]);
  });
});

describe("getSourceDestinationMatrix", () => {
  it("returns counts per (source, clicked_slug) pair", async () => {
    await insertLinkClick({ source: "instagram", clickedSlug: "spotify" });
    await insertLinkClick({ source: "instagram", clickedSlug: "spotify" });
    await insertLinkClick({ source: "instagram", clickedSlug: "youtube" });
    await insertLinkClick({ source: "direct", clickedSlug: "spotify" });

    const result = await getSourceDestinationMatrix(db, null);
    const sorted = [...result].sort((a, b) =>
      `${a.source}-${a.slug}`.localeCompare(`${b.source}-${b.slug}`)
    );
    expect(sorted).toEqual([
      { source: "direct", slug: "spotify", count: 1 },
      { source: "instagram", slug: "spotify", count: 2 },
      { source: "instagram", slug: "youtube", count: 1 },
    ]);
  });
});

describe("getCountryCounts", () => {
  it("returns page_view counts grouped by country, sorted desc", async () => {
    await insertPageView({ source: "instagram", country: "AR" });
    await insertPageView({ source: "instagram", country: "AR" });
    await insertPageView({ source: "direct", country: "US" });
    // null country must NOT appear
    await insertPageView({ source: "youtube", country: null });

    const result = await getCountryCounts(db, null, 10);
    expect(result).toEqual([
      { country: "AR", count: 2 },
      { country: "US", count: 1 },
    ]);
  });

  it("respects the limit", async () => {
    await insertPageView({ source: "x", country: "A" });
    await insertPageView({ source: "x", country: "A" });
    await insertPageView({ source: "x", country: "B" });
    await insertPageView({ source: "x", country: "C" });

    const result = await getCountryCounts(db, null, 2);
    expect(result).toHaveLength(2);
  });
});

describe("getDailySeries", () => {
  it("returns one row per day with both type counts", async () => {
    await insertPageView({ source: "x", createdAt: "2026-05-01 10:00:00" });
    await insertPageView({ source: "x", createdAt: "2026-05-01 12:00:00" });
    await insertLinkClick({
      source: "x",
      clickedSlug: "y",
      createdAt: "2026-05-02 10:00:00",
    });

    const result = await getDailySeries(db, null);
    expect(result).toEqual([
      { day: "2026-05-01", pageViews: 2, linkClicks: 0 },
      { day: "2026-05-02", pageViews: 0, linkClicks: 1 },
    ]);
  });

  it("returns an empty array when there are no events", async () => {
    expect(await getDailySeries(db, null)).toEqual([]);
  });
});

describe("fillDailyGaps", () => {
  it("fills missing days with zero counts", () => {
    const sparse = [
      { day: "2026-05-01", pageViews: 2, linkClicks: 0 },
      { day: "2026-05-04", pageViews: 1, linkClicks: 1 },
    ];
    expect(fillDailyGaps(sparse, "2026-05-01", "2026-05-04")).toEqual([
      { day: "2026-05-01", pageViews: 2, linkClicks: 0 },
      { day: "2026-05-02", pageViews: 0, linkClicks: 0 },
      { day: "2026-05-03", pageViews: 0, linkClicks: 0 },
      { day: "2026-05-04", pageViews: 1, linkClicks: 1 },
    ]);
  });

  it("fills the full range when input is empty", () => {
    expect(fillDailyGaps([], "2026-05-01", "2026-05-03")).toEqual([
      { day: "2026-05-01", pageViews: 0, linkClicks: 0 },
      { day: "2026-05-02", pageViews: 0, linkClicks: 0 },
      { day: "2026-05-03", pageViews: 0, linkClicks: 0 },
    ]);
  });

  it("returns the input unchanged when start equals end and the day is present", () => {
    const sparse = [{ day: "2026-05-01", pageViews: 5, linkClicks: 2 }];
    expect(fillDailyGaps(sparse, "2026-05-01", "2026-05-01")).toEqual(sparse);
  });

  it("returns one zero row when start equals end and input is empty", () => {
    expect(fillDailyGaps([], "2026-05-01", "2026-05-01")).toEqual([
      { day: "2026-05-01", pageViews: 0, linkClicks: 0 },
    ]);
  });
});
