// Hy-An YouTube channel. The public page embeds one chosen upload; the admin
// fetches the recent uploads via the "Fetch channel" button and picks which one
// to show (no automatic polling — and it lets the admin skip Shorts, which the
// RSS feed doesn't flag).
export const YOUTUBE_CHANNEL_ID = "UCUuwO5OGUKD_W9tm-yrB_uQ";

export interface LatestVideo {
  id: string;
  title: string;
}

export function channelFeedUrl(channelId: string = YOUTUBE_CHANNEL_ID): string {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
}

export function videoThumbnailUrl(id: string): string {
  return `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
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
 * Extract the recent uploads from a YouTube channel RSS feed, newest-first.
 * Regex-based (the Workers runtime has no DOMParser); the feed shape is stable.
 * Entries without a videoId are skipped rather than failing the whole parse.
 */
export function parseVideoList(xml: string, limit = 10): LatestVideo[] {
  const videos: LatestVideo[] = [];
  const entryRe = /<entry>([\s\S]*?)<\/entry>/g;
  let match: RegExpExecArray | null;
  while ((match = entryRe.exec(xml)) !== null && videos.length < limit) {
    const entry = match[1];
    const idMatch = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
    if (!idMatch) continue;
    const titleMatch = entry.match(/<title>([\s\S]*?)<\/title>/);
    videos.push({
      id: idMatch[1].trim(),
      title: titleMatch ? decodeXmlEntities(titleMatch[1].trim()) : "",
    });
  }
  return videos;
}

export async function fetchLatestVideos(
  channelId: string = YOUTUBE_CHANNEL_ID,
  limit = 10
): Promise<LatestVideo[]> {
  const res = await fetch(channelFeedUrl(channelId));
  if (!res.ok) return [];
  return parseVideoList(await res.text(), limit);
}
