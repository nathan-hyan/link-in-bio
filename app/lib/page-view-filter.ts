// Slugs (and therefore legitimate inbound sources) match this pattern — see
// CLAUDE.md schema. Anything else in the path is a scanner probe (.env,
// config.json, sitemap.xml, .git/config, …), never a real visitor's source.
const SLUG_PATTERN = /^[a-z0-9-]+$/;

// Substrings that mark a request as automated. Case-insensitive. Kept broad on
// purpose: the goal is to keep the events table free of crawler/scanner noise,
// not to perfectly classify every agent. Edge-level Bot Fight Mode handles the
// headless-browser UAs that are indistinguishable from real ones here.
const BOT_UA =
  /(?:bot\b|crawl|spider|scan|slurp|http-client|python-requests|go-http|libwww|curl|wget|censys|leakix|externalhit|xpanse|headless|semrush|ahrefs|dataprovider|masscan|zgrab)/i;

function isProbePath(rawPath: string): boolean {
  return rawPath !== "" && !SLUG_PATTERN.test(rawPath);
}

function isBotUserAgent(userAgent: string | null): boolean {
  return userAgent !== null && BOT_UA.test(userAgent);
}

/**
 * Decide whether a page_view is worth recording. Filters out scanner probes
 * (paths that can't be valid slugs) and known bots/crawlers by user-agent so
 * analytics reflects real visitors. A missing user-agent is logged (real
 * browsers always send one; being conservative avoids dropping edge cases).
 */
export function shouldLogPageView({
  rawPath,
  userAgent,
}: {
  rawPath: string;
  userAgent: string | null;
}): boolean {
  return !isProbePath(rawPath) && !isBotUserAgent(userAgent);
}
