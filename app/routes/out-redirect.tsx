import { redirect } from "react-router";
import type { Route } from "./+types/out-redirect";
import { getDb } from "../db/client";
import { logLinkClick } from "../lib/events";
import { getEnabledLinkBySlug } from "../lib/links";
import { DIRECT } from "../lib/source-resolution";

export async function loader({
  context,
  params,
  request,
}: Route.LoaderArgs) {
  const db = getDb(context.cloudflare.env.DB);
  const link = await getEnabledLinkBySlug(db, params.slug);

  if (!link) {
    throw new Response("Not Found", { status: 404 });
  }

  const url = new URL(request.url);
  const source = url.searchParams.get("source") || DIRECT;

  await logLinkClick({
    db,
    clickedSlug: params.slug,
    source,
    request,
  });

  return redirect(link.url);
}

export default function OutRedirect() {
  return null;
}
