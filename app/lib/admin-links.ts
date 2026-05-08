import { and, asc, eq, max, ne, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { type Link, links } from "../db/schema";

const SLUG_PATTERN = /^[a-z0-9-]+$/;
export const RESERVED_SLUGS = new Set(["admin", "out", "api", "settings"]);

export type AdminLinkResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number };

function ok<T>(data: T): AdminLinkResult<T> {
  return { ok: true, data };
}

function fail(error: string, status: number): AdminLinkResult<never> {
  return { ok: false, error, status };
}

export interface CreateLinkInput {
  slug: string;
  label: string;
  url: string;
}

export interface UpdateLinkInput {
  slug?: string;
  label?: string;
  url?: string;
  enabled?: boolean;
}

function validateSlug(slug: string): string | null {
  if (!slug) return "Slug is required.";
  if (!SLUG_PATTERN.test(slug))
    return "Slug must be lowercase letters, digits, or hyphens.";
  if (RESERVED_SLUGS.has(slug))
    return `"${slug}" is a reserved path and cannot be used as a slug.`;
  return null;
}

function validateUrl(url: string): string | null {
  if (!url) return "URL is required.";
  try {
    new URL(url);
    return null;
  } catch {
    return "URL is not valid.";
  }
}

async function countEnabled(db: Db): Promise<number> {
  const [row] = await db
    .select({ c: sql<number>`COUNT(*)` })
    .from(links)
    .where(eq(links.enabled, true));
  return Number(row?.c ?? 0);
}

export async function getAllLinks(db: Db): Promise<Link[]> {
  return db.select().from(links).orderBy(asc(links.position));
}

export async function createLink(
  db: Db,
  input: CreateLinkInput
): Promise<AdminLinkResult<Link>> {
  const slug = input.slug.trim();
  const label = input.label.trim();
  const url = input.url.trim();

  const slugErr = validateSlug(slug);
  if (slugErr) return fail(slugErr, 400);
  if (!label) return fail("Label is required.", 400);
  const urlErr = validateUrl(url);
  if (urlErr) return fail(urlErr, 400);

  const conflict = await db
    .select()
    .from(links)
    .where(eq(links.slug, slug))
    .limit(1);
  if (conflict.length > 0)
    return fail(`Slug "${slug}" is already in use.`, 409);

  const [maxRow] = await db.select({ max: max(links.position) }).from(links);
  const nextPos = (maxRow?.max ?? 0) + 1;

  const [created] = await db
    .insert(links)
    .values({ slug, label, url, position: nextPos, enabled: true })
    .returning();

  return ok(created);
}

export async function updateLink(
  db: Db,
  id: number,
  input: UpdateLinkInput
): Promise<AdminLinkResult<Link>> {
  const [existing] = await db
    .select()
    .from(links)
    .where(eq(links.id, id))
    .limit(1);
  if (!existing) return fail("Link not found.", 404);

  const updates: Record<string, unknown> = {};

  if (input.slug !== undefined) {
    const slug = input.slug.trim();
    const slugErr = validateSlug(slug);
    if (slugErr) return fail(slugErr, 400);
    if (slug !== existing.slug) {
      const conflict = await db
        .select()
        .from(links)
        .where(and(eq(links.slug, slug), ne(links.id, id)))
        .limit(1);
      if (conflict.length > 0)
        return fail(`Slug "${slug}" is already in use.`, 409);
      updates.slug = slug;
    }
  }

  if (input.label !== undefined) {
    const label = input.label.trim();
    if (!label) return fail("Label is required.", 400);
    updates.label = label;
  }

  if (input.url !== undefined) {
    const url = input.url.trim();
    const urlErr = validateUrl(url);
    if (urlErr) return fail(urlErr, 400);
    updates.url = url;
  }

  if (input.enabled !== undefined && input.enabled !== existing.enabled) {
    if (existing.enabled === true && input.enabled === false) {
      const enabledCount = await countEnabled(db);
      if (enabledCount <= 1) {
        return fail(
          "Cannot disable the last enabled link — the public page would 503.",
          422
        );
      }
    }
    updates.enabled = input.enabled;
  }

  if (Object.keys(updates).length === 0) {
    return ok(existing);
  }

  updates.updatedAt = sql`(CURRENT_TIMESTAMP)`;

  const [updated] = await db
    .update(links)
    .set(updates)
    .where(eq(links.id, id))
    .returning();
  return ok(updated);
}

export async function deleteLink(
  db: Db,
  id: number
): Promise<AdminLinkResult<{ id: number }>> {
  const [existing] = await db
    .select()
    .from(links)
    .where(eq(links.id, id))
    .limit(1);
  if (!existing) return fail("Link not found.", 404);

  if (existing.enabled) {
    const enabledCount = await countEnabled(db);
    if (enabledCount <= 1) {
      return fail(
        "Cannot delete the last enabled link — the public page would 503.",
        422
      );
    }
  }

  await db.delete(links).where(eq(links.id, id));
  return ok({ id });
}

export async function moveLink(
  db: Db,
  id: number,
  direction: "up" | "down"
): Promise<AdminLinkResult<{ id: number }>> {
  const all = await getAllLinks(db);
  const idx = all.findIndex((l) => l.id === id);
  if (idx === -1) return fail("Link not found.", 404);

  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= all.length) {
    // No-op at the edge
    return ok({ id });
  }

  const a = all[idx];
  const b = all[swapIdx];

  // Two updates; positions have no UNIQUE constraint, so no temp-pos dance
  // is needed. If the second update fails for any reason both rows would
  // briefly share a position; the next admin click recovers.
  await db
    .update(links)
    .set({ position: b.position, updatedAt: sql`(CURRENT_TIMESTAMP)` })
    .where(eq(links.id, a.id));
  await db
    .update(links)
    .set({ position: a.position, updatedAt: sql`(CURRENT_TIMESTAMP)` })
    .where(eq(links.id, b.id));

  return ok({ id });
}
