import { describe, expect, it } from "vitest";
import { parseLatestVideo } from "./youtube";

const FEED = (entries: string) =>
  `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns="http://www.w3.org/2005/Atom">
  <title>Hy-An</title>
  ${entries}
</feed>`;

const ENTRY = (id: string, title: string) =>
  `<entry>
    <id>yt:video:${id}</id>
    <yt:videoId>${id}</yt:videoId>
    <title>${title}</title>
  </entry>`;

describe("parseLatestVideo", () => {
  it("returns the first entry's video id and title", () => {
    const xml = FEED(ENTRY("abc123", "Newest Track") + ENTRY("old999", "Older"));
    expect(parseLatestVideo(xml)).toEqual({ id: "abc123", title: "Newest Track" });
  });

  it("picks the first entry, not the channel-level title", () => {
    const xml = FEED(ENTRY("vid1", "Actual Video Title"));
    // The feed's own <title> is "Hy-An"; the entry title must win.
    expect(parseLatestVideo(xml)?.title).toBe("Actual Video Title");
  });

  it("decodes XML entities in the title", () => {
    const xml = FEED(ENTRY("vid1", "Rock &amp; Roll &#39;95&#39; &lt;live&gt;"));
    expect(parseLatestVideo(xml)?.title).toBe("Rock & Roll '95' <live>");
  });

  it("returns null when there are no entries", () => {
    expect(parseLatestVideo(FEED(""))).toBeNull();
  });

  it("returns null when an entry has no videoId", () => {
    const xml = FEED(`<entry><title>No id here</title></entry>`);
    expect(parseLatestVideo(xml)).toBeNull();
  });

  it("returns null for garbage input", () => {
    expect(parseLatestVideo("not xml at all")).toBeNull();
  });
});
