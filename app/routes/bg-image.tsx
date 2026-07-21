import type { Route } from "./+types/bg-image";
import { BG_KV_KEY } from "../lib/media-upload";

/**
 * Resource route: serves the uploaded background image from KV. The public
 * page references this via the `bg_image_url` setting (`/media/bg?v=<ts>`).
 * The `?v` query changes on every upload, so a given URL's bytes never change
 * — hence the immutable, long-lived cache headers.
 */
export async function loader({ context }: Route.LoaderArgs) {
  const kv = context.cloudflare.env.MEDIA;
  const { value, metadata } = await kv.getWithMetadata<{ contentType?: string }>(
    BG_KV_KEY,
    { type: "arrayBuffer" }
  );

  if (!value) {
    throw new Response("No background image uploaded.", { status: 404 });
  }

  return new Response(value, {
    headers: {
      "Content-Type": metadata?.contentType ?? "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
