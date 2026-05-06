import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const links = sqliteTable("links", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  label: text("label").notNull(),
  url: text("url").notNull(),
  position: integer("position").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

export const events = sqliteTable("events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type", { enum: ["page_view", "link_click"] }).notNull(),
  source: text("source").notNull(),
  rawPath: text("raw_path"),
  clickedSlug: text("clicked_slug"),
  country: text("country"),
  userAgent: text("user_agent"),
  referrer: text("referrer"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

export type Link = typeof links.$inferSelect;
export type NewLink = typeof links.$inferInsert;
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
