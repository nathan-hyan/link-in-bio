import { and, asc, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { type Link, links } from "../db/schema";

export async function getEnabledLinks(db: Db): Promise<Link[]> {
  return db
    .select()
    .from(links)
    .where(eq(links.enabled, true))
    .orderBy(asc(links.position));
}

export async function getEnabledLinkBySlug(
  db: Db,
  slug: string
): Promise<Link | null> {
  const [link] = await db
    .select()
    .from(links)
    .where(and(eq(links.slug, slug), eq(links.enabled, true)))
    .limit(1);
  return link ?? null;
}
