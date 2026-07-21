# 08 — Latest YouTube video

## Purpose

Show one chosen Hy-An video as a real, playable embed on the public page — to
the **right** of the links card on desktop, at the **bottom** on mobile. The
video is chosen by the admin, not polled automatically: an admin presses **Fetch
channel** in `/admin/settings`, the app pulls the 10 most recent uploads from the
channel RSS feed and renders them as a thumbnail picker; clicking one stores its
id + title in the `settings` table. The public page embeds whatever is stored.
No video stored → nothing renders (the page looks exactly as before).

**Why a picker, not auto-pick-newest:** the uploads feed mixes in Shorts and
doesn't flag them, so the newest entry is often a Short (useless on this page).
Letting the admin choose sidesteps that — no fragile Shorts-detection heuristic.

## Files

### App code
- `app/lib/youtube.ts` — **new**.
  - `YOUTUBE_CHANNEL_ID` — the Hy-An channel (`UCUuwO5OGUKD_W9tm-yrB_uQ`).
  - `channelFeedUrl(channelId?)` → `https://www.youtube.com/feeds/videos.xml?channel_id=…`.
  - `videoThumbnailUrl(id)` → `https://i.ytimg.com/vi/<id>/mqdefault.jpg` (picker thumbnails).
  - `parseVideoList(xml, limit=10)` → `{ id, title }[]`, newest-first. Pure. Regex
    over the RSS (the Workers runtime has no `DOMParser`); pulls each `<entry>`'s
    `<yt:videoId>` and `<title>`, decodes XML entities, skips entries with no id.
  - `fetchLatestVideos(channelId?, limit=10)` → fetches the feed and parses it;
    `[]` on a non-OK response.
- `app/lib/youtube.test.ts` — **new**. 7 cases for `parseVideoList`: newest-first
  order, entry title beats the channel title, entity decoding, limit, skips
  entries without a videoId, no entries, garbage input.
- `app/lib/settings.ts` — **modified**. Adds `SETTING_LATEST_VIDEO_ID` /
  `SETTING_LATEST_VIDEO_TITLE` keys and `getLatestVideo(db) → { id, title } | null`
  (returns `null` when no id stored; title defaults to `""`).
- `app/lib/settings.test.ts` — **modified**. +3 cases for `getLatestVideo`.
- `app/routes/admin.settings.tsx` — **modified**. Loader also returns
  `latestVideo` (the current selection). Action branches on a hidden `intent`
  field: `fetch-video` returns the 10 recent uploads (`{ videos }`),
  `set-video` reads the clicked video (JSON-encoded in the submit button's
  `value`) and upserts both settings; otherwise the existing background-upload
  path runs. Component shows the current embed, a **Fetch channel** button, and
  — after a fetch — a thumbnail picker (`<button>` per video) that saves on click.
- `app/routes/home.tsx` — **modified**. Loader adds `getLatestVideo` to its
  `Promise.all`. Layout wraps the links card + an optional video card in a
  `flex flex-col lg:flex-row` container (video stacks below on mobile, sits to
  the right on desktop). Video card is the same frosted-glass style, with a
  16:9 (`aspect-video`) YouTube `<iframe>`.

### Docs
- `docs/08-latest-video.md` — this file.

## Routes / Endpoints

| Path | Method | Behavior |
|---|---|---|
| `/admin/settings` | POST (`intent=fetch-video`) | Fetches the 10 recent uploads. Returns `{ videos }` or `{ videoError }`. CF Access required. |
| `/admin/settings` | POST (`intent=set-video`) | Stores the chosen video's id + title. Returns `{ videoOk, video }` or `{ videoError }`. CF Access required. |
| `/` | GET | Loader reads `getLatestVideo`; component renders the embed card when a video is stored (else nothing). |

The background-upload POST on the same route is unchanged — the action tells the
two apart by the presence of `intent=fetch-video`.

## Database

Reuses the generic `settings` table (no migration). Two new keys:
`latest_video_id`, `latest_video_title`. Written by the fetch action, read by
the home + settings loaders.

## Tests

- `app/lib/youtube.test.ts` (7) — pure `parseVideoList`, per the CLAUDE.md TDD rule.
- `app/lib/settings.test.ts` (+3) — `getLatestVideo` roundtrip / null / title default.
- `fetchLatestVideos` (network) and the route wiring are **not** unit-tested;
  verified locally against the real channel (`pnpm dev` → `POST intent=fetch-video`
  returned 10 uploads with thumbnails) and the public embed was verified with a
  seeded `latest_video_id` (homepage emits `youtube.com/embed/<id>` in an
  `aspect-video` card).

## Dependencies

**Depends on:**
- [00-foundation](00-foundation.md), [01-public-page](01-public-page.md),
  [04-backoffice-auth](04-backoffice-auth.md),
  [05-admin-background](05-admin-background.md) — reuses the `settings` table and
  the admin `Form` + action pattern.

## Notes / Decisions

### Manual fetch, not automatic
The admin controls releases, so there's no polling or per-request RSS call
(which would add latency and hit YouTube on every visit). One button, one
fetch, stored result. Simplest thing that meets the requirement.

### RSS feed, not the Data API
The channel uploads feed (`/feeds/videos.xml`) needs no API key and no quota,
and returns entries newest-first — exactly enough to pick the latest video.

### Embed, not a link
Requirement was "THE video", i.e. a playable player, not another link button.
The stored id goes into `https://www.youtube.com/embed/<id>` in an `<iframe>`.

### Layout
Links card and video card are siblings in a flex container: `flex-col` on
mobile (video below the links, fixed 16:9), `lg:flex-row` on desktop (video to
the right). On desktop the container is `lg:items-stretch` and the video's
inner wrapper is `lg:aspect-auto lg:flex-1`, so the video card matches the links
card's height and the player fills it (bigger than a fixed 16:9). No heading on
the video card. When no video is stored the container holds a single `max-w-md`
card — visually identical to the pre-feature page.
