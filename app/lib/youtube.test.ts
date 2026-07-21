import { describe, expect, it } from "vitest";
import { parseVideoList } from "./youtube";

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

describe("parseVideoList", () => {
  it("returns entries newest-first with id and title", () => {
    const xml = FEED(ENTRY("abc123", "Newest") + ENTRY("old999", "Older"));
    expect(parseVideoList(xml)).toEqual([
      { id: "abc123", title: "Newest" },
      { id: "old999", title: "Older" },
    ]);
  });

  it("uses the entry title, not the channel-level title", () => {
    const xml = FEED(ENTRY("vid1", "Actual Video Title"));
    expect(parseVideoList(xml)[0].title).toBe("Actual Video Title");
  });

  it("decodes XML entities in the title", () => {
    const xml = FEED(ENTRY("vid1", "Rock &amp; Roll &#39;95&#39; &lt;live&gt;"));
    expect(parseVideoList(xml)[0].title).toBe("Rock & Roll '95' <live>");
  });

  it("respects the limit", () => {
    const xml = FEED(
      ENTRY("a", "1") + ENTRY("b", "2") + ENTRY("c", "3")
    );
    expect(parseVideoList(xml, 2).map((v) => v.id)).toEqual(["a", "b"]);
  });

  it("skips entries without a videoId, keeping the rest", () => {
    const xml = FEED(
      `<entry><title>No id</title></entry>` + ENTRY("good", "Has id")
    );
    expect(parseVideoList(xml)).toEqual([{ id: "good", title: "Has id" }]);
  });

  it("returns an empty array when there are no entries", () => {
    expect(parseVideoList(FEED(""))).toEqual([]);
  });

  it("returns an empty array for garbage input", () => {
    expect(parseVideoList("not xml at all")).toEqual([]);
  });
});
