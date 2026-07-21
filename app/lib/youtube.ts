// Hy-An YouTube channel. The public page embeds the latest upload; the admin
// refreshes it manually via the "Fetch channel" button (no automatic polling).
export const YOUTUBE_CHANNEL_ID = "UCUuwO5OGUKD_W9tm-yrB_uQ";

export interface LatestVideo {
  id: string;
  title: string;
}

export function channelFeedUrl(channelId: string = YOUTUBE_CHANNEL_ID): string {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&#x0*27;/gi, "'")
    .replace(/&amp;/g, "&");
}

/**
 * Extract the newest video from a YouTube channel RSS feed. Entries are ordered
 * newest-first, so the first `<entry>` is the latest upload. Regex-based (the
 * Workers runtime has no DOMParser); the feed shape is stable and simple.
 */
export function parseLatestVideo(xml: string): LatestVideo | null {
  const entryMatch = xml.match(/<entry>([\s\S]*?)<\/entry>/);
  if (!entryMatch) return null;

  const entry = entryMatch[1];
  const idMatch = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
  if (!idMatch) return null;

  const titleMatch = entry.match(/<title>([\s\S]*?)<\/title>/);
  return {
    id: idMatch[1].trim(),
    title: titleMatch ? decodeXmlEntities(titleMatch[1].trim()) : "",
  };
}

export async function fetchLatestVideo(
  channelId: string = YOUTUBE_CHANNEL_ID
): Promise<LatestVideo | null> {
  const res = await fetch(channelFeedUrl(channelId));
  if (!res.ok) return null;
  return parseLatestVideo(await res.text());
}
