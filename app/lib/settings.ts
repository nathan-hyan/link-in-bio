import { eq, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { settings } from "../db/schema";

export const SETTING_BG_IMAGE_URL = "bg_image_url";
export const DEFAULT_BG_IMAGE_URL = "/bg.png";
export const SETTING_LATEST_VIDEO_ID = "latest_video_id";
export const SETTING_LATEST_VIDEO_TITLE = "latest_video_title";

export async function getSetting(
  db: Db,
  key: string
): Promise<string | null> {
  const [row] = await db
    .select()
    .from(settings)
    .where(eq(settings.key, key))
    .limit(1);
  return row?.value ?? null;
}

export async function setSetting(
  db: Db,
  key: string,
  value: string
): Promise<void> {
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value, updatedAt: sql`(CURRENT_TIMESTAMP)` },
    });
}

export async function getBgImageUrl(db: Db): Promise<string> {
  const stored = await getSetting(db, SETTING_BG_IMAGE_URL);
  return stored && stored.length > 0 ? stored : DEFAULT_BG_IMAGE_URL;
}

export async function getLatestVideo(
  db: Db
): Promise<{ id: string; title: string } | null> {
  const id = await getSetting(db, SETTING_LATEST_VIDEO_ID);
  if (!id) return null;
  const title = (await getSetting(db, SETTING_LATEST_VIDEO_TITLE)) ?? "";
  return { id, title };
}
