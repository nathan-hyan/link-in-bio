import { sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { events } from "../db/schema";

export type DateRange = "7d" | "30d" | "90d" | "all";

export function parseDateRange(input: string | null): DateRange {
  if (input === "7d" || input === "30d" || input === "90d" || input === "all")
    return input;
  return "30d";
}

/**
 * Returns a YYYY-MM-DD string representing the lower bound of the given range,
 * or null when the range is "all" (no lower bound).
 */
export function rangeToStartDate(
  range: DateRange,
  now: Date = new Date()
): string | null {
  if (range === "all") return null;
  const days = parseInt(range, 10);
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * Builds the WHERE-equivalent SQL fragment that filters events by start date.
 * Caller passes this to .where(...). Both sides are wrapped in date() so the
 * comparison is at day granularity regardless of the stored timestamp format.
 */
function startDateFilter(start: string | null) {
  if (!start) return undefined;
  return sql`date(${events.createdAt}) >= date(${start})`;
}

export async function getTotals(
  db: Db,
  start: string | null
): Promise<{ pageViews: number; linkClicks: number }> {
  const [row] = await db
    .select({
      pageViews: sql<number>`SUM(CASE WHEN ${events.type} = 'page_view' THEN 1 ELSE 0 END)`,
      linkClicks: sql<number>`SUM(CASE WHEN ${events.type} = 'link_click' THEN 1 ELSE 0 END)`,
    })
    .from(events)
    .where(startDateFilter(start));

  return {
    pageViews: Number(row?.pageViews ?? 0),
    linkClicks: Number(row?.linkClicks ?? 0),
  };
}

export async function getSourceCounts(
  db: Db,
  start: string | null
): Promise<Array<{ source: string; count: number }>> {
  const rows = await db
    .select({
      source: events.source,
      count: sql<number>`COUNT(*)`,
    })
    .from(events)
    .where(
      sql`${events.type} = 'page_view'${start ? sql` AND date(${events.createdAt}) >= date(${start})` : sql``}`
    )
    .groupBy(events.source)
    .orderBy(sql`COUNT(*) DESC`);

  return rows.map((r) => ({ source: r.source, count: Number(r.count) }));
}

export async function getDestinationCounts(
  db: Db,
  start: string | null
): Promise<Array<{ slug: string; count: number }>> {
  const rows = await db
    .select({
      slug: events.clickedSlug,
      count: sql<number>`COUNT(*)`,
    })
    .from(events)
    .where(
      sql`${events.type} = 'link_click'${start ? sql` AND date(${events.createdAt}) >= date(${start})` : sql``}`
    )
    .groupBy(events.clickedSlug)
    .orderBy(sql`COUNT(*) DESC`);

  // Filter out null slugs (defensive — link_click rows always have a slug,
  // but the column is nullable in the schema).
  return rows
    .filter((r) => r.slug !== null)
    .map((r) => ({ slug: r.slug as string, count: Number(r.count) }));
}

export async function getSourceDestinationMatrix(
  db: Db,
  start: string | null
): Promise<Array<{ source: string; slug: string; count: number }>> {
  const rows = await db
    .select({
      source: events.source,
      slug: events.clickedSlug,
      count: sql<number>`COUNT(*)`,
    })
    .from(events)
    .where(
      sql`${events.type} = 'link_click'${start ? sql` AND date(${events.createdAt}) >= date(${start})` : sql``}`
    )
    .groupBy(events.source, events.clickedSlug)
    .orderBy(sql`COUNT(*) DESC`);

  return rows
    .filter((r) => r.slug !== null)
    .map((r) => ({
      source: r.source,
      slug: r.slug as string,
      count: Number(r.count),
    }));
}

export async function getCountryCounts(
  db: Db,
  start: string | null,
  limit: number
): Promise<Array<{ country: string; count: number }>> {
  const rows = await db
    .select({
      country: events.country,
      count: sql<number>`COUNT(*)`,
    })
    .from(events)
    .where(
      sql`${events.type} = 'page_view' AND ${events.country} IS NOT NULL${start ? sql` AND date(${events.createdAt}) >= date(${start})` : sql``}`
    )
    .groupBy(events.country)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(limit);

  return rows
    .filter((r) => r.country !== null)
    .map((r) => ({ country: r.country as string, count: Number(r.count) }));
}

export async function getDailySeries(
  db: Db,
  start: string | null
): Promise<Array<{ day: string; pageViews: number; linkClicks: number }>> {
  const rows = await db
    .select({
      day: sql<string>`date(${events.createdAt})`,
      pageViews: sql<number>`SUM(CASE WHEN ${events.type} = 'page_view' THEN 1 ELSE 0 END)`,
      linkClicks: sql<number>`SUM(CASE WHEN ${events.type} = 'link_click' THEN 1 ELSE 0 END)`,
    })
    .from(events)
    .where(startDateFilter(start))
    .groupBy(sql`date(${events.createdAt})`)
    .orderBy(sql`date(${events.createdAt}) ASC`);

  return rows.map((r) => ({
    day: r.day,
    pageViews: Number(r.pageViews),
    linkClicks: Number(r.linkClicks),
  }));
}

/**
 * Pads a sparse daily series with zero rows for missing days, inclusive on
 * both ends. Used so the time-series chart shows a continuous x-axis.
 */
export function fillDailyGaps(
  sparse: Array<{ day: string; pageViews: number; linkClicks: number }>,
  start: string,
  end: string
): Array<{ day: string; pageViews: number; linkClicks: number }> {
  const map = new Map(sparse.map((r) => [r.day, r]));
  const out: Array<{ day: string; pageViews: number; linkClicks: number }> = [];
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  const cursor = new Date(startDate);
  while (cursor.getTime() <= endDate.getTime()) {
    const key = cursor.toISOString().slice(0, 10);
    out.push(map.get(key) ?? { day: key, pageViews: 0, linkClicks: 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}
