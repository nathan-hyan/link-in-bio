import { asc, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { type Link, links } from "../db/schema";

export async function getEnabledLinks(db: Db): Promise<Link[]> {
  return db
    .select()
    .from(links)
    .where(eq(links.enabled, true))
    .orderBy(asc(links.position));
}
