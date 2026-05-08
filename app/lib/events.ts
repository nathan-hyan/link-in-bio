import type { Db } from "../db/client";
import { events } from "../db/schema";

function header(request: Request, name: string): string | null {
  return request.headers.get(name) || null;
}

export async function logPageView({
  db,
  source,
  rawPath,
  request,
}: {
  db: Db;
  source: string;
  rawPath: string;
  request: Request;
}): Promise<void> {
  await db.insert(events).values({
    type: "page_view",
    source,
    rawPath: rawPath || null,
    country: header(request, "cf-ipcountry"),
    userAgent: header(request, "user-agent"),
    referrer: header(request, "referer"),
  });
}

export async function logLinkClick({
  db,
  clickedSlug,
  source,
  request,
}: {
  db: Db;
  clickedSlug: string;
  source: string;
  request: Request;
}): Promise<void> {
  await db.insert(events).values({
    type: "link_click",
    source,
    clickedSlug,
    country: header(request, "cf-ipcountry"),
    userAgent: header(request, "user-agent"),
    referrer: header(request, "referer"),
  });
}
