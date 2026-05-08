# 03 — Outbound click tracking

## Purpose

When the visitor clicks a link button, log a `link_click` event with the inbound `source` and the `clicked_slug` of the destination button, then 302 to the actual URL. Buttons no longer link directly to the destination — they go through `/out/:slug` first.

This closes the analytics loop: combined with Feature 02's page_view events, we can answer "of the N visitors who arrived via Instagram, how many clicked Spotify?" — i.e., the source × destination matrix in the analytics dashboard.

## Files

### App code
- `app/lib/events.ts` — **modified**. Added `logLinkClick({ db, clickedSlug, source, request })` next to the existing `logPageView`. Same insert pattern, different `type`.
- `app/lib/events.test.ts` — **modified**. Added 2 cases for `logLinkClick` (basic insert + header capture).
- `app/lib/links.ts` — **modified**. Added `getEnabledLinkBySlug(db, slug): Promise<Link | null>` — returns null if missing or disabled.
- `app/lib/links.test.ts` — **modified**. Added 3 cases for `getEnabledLinkBySlug` (missing → null, disabled → null, enabled → link).
- `app/routes/out-redirect.tsx` — **new**. Loader for `/out/:slug`: looks up the link, 404s if not found/disabled, logs `link_click`, 302s to the URL via `redirect(link.url)` from `react-router`. Component is a no-op stub (loader always returns Response).
- `app/routes.ts` — **modified**. Added `route("out/:slug", "routes/out-redirect.tsx")` before the `:slug?` catch route. More specific patterns win in RR routing, so `/out/spotify` matches the redirect, not the catch.
- `app/routes/home.tsx` — **modified**. Loader returns `source` alongside `links`. Component renders each button as `<a href={`/out/${slug}?source=${encodeURIComponent(source)}`}>` instead of the raw URL.

### Test infra
- `vitest.config.ts` — **modified**. Added explicit `test.exclude` covering `.git`, `.react-router`, `.wrangler`, `.claude`. Stops Vitest from crawling stale Claude Code worktrees.
- `.gitignore` — **modified**. Adds `.claude/worktrees/`.

### Docs
- `docs/03-outbound-tracking.md` — this file.

## Routes / Endpoints

| Path | Handler | Behavior |
|---|---|---|
| `/out/:slug` | `routes/out-redirect.tsx` | If `slug` matches an enabled link: log `link_click` event with `clickedSlug = slug`, `source = ?source` query param (default `direct`), then 302 to `link.url`. If unknown/disabled: 404. |

The `?source=` query param carries the inbound source from the page that rendered the button. Always present in our generated links — we always include it explicitly (`source=direct` when the page was reached via `/`).

## Database

**Reads:** single row from `links` by slug + enabled (`getEnabledLinkBySlug`).
**Writes:** one row into `events` per click — same shape as `logPageView`, but `type = 'link_click'`, `clickedSlug` set, `rawPath` always null.

No migrations.

## Tests

- `app/lib/events.test.ts` — `logLinkClick` (2 new cases, 6 total in file)
- `app/lib/links.test.ts` — `getEnabledLinkBySlug` (3 new cases, 7 total in file)

23 tests across the project, all green. The redirect loader itself is **not** integration-tested in vitest — it's a thin compose of two tested helpers (`getEnabledLinkBySlug` + `logLinkClick`) plus `redirect()` from RR. Verified manually:

```
GET /out/spotify?source=instagram   →  302 → https://open.spotify.com/artist/hyan
GET /out/nonexistent                 →  404
```
And the corresponding `link_click` row appears in `events`.

## Dependencies

**Depends on:**
- 00-foundation — schema, drizzle, vitest pool-workers
- 01-public-page — `getEnabledLinks` (reused in home loader)
- 02-source-tracking — `resolveSource` + `logPageView` + the `source` value flowing through the home loader, which we now pass to button `href` URLs

**Depended on by:**
- 06-backoffice-analytics — `link_click` events feed the destinations bar chart and the source × destination matrix
- 05-backoffice-links — the last-link guard prevents disabling all enabled links, which would also break button rendering (no buttons → no clicks)

## Notes / Decisions

### Source carried in URL query param, not Referer

Each button's `href` includes `?source=:source` so the redirect handler knows the inbound source without parsing Referer. Reasons:
1. Reliable — query params always present; Referer can be stripped by browsers, especially with `target="_blank"` and `rel="noopener noreferrer"`.
2. Stateless — no session/cookie needed.
3. Predictable — analytics behavior doesn't depend on browser settings.

Cost: the URL is slightly uglier (`/out/spotify?source=instagram`). Acceptable for an internal-flow URL the user rarely sees.

### `getEnabledLinkBySlug` returns null for disabled links

A disabled link's slug is treated the same as a missing slug — both return null, and the route 404s. Consistent with how source-tracking treats disabled slugs as `direct` (Feature 02). Disabled = unavailable, full stop.

### Stub component for the redirect route

React Router 7 framework mode requires a default export from each route file. The redirect's loader always returns a `Response` (either `redirect(...)` or a thrown 404), so the component is never rendered. We export `() => null` to satisfy the type system.

### Route ordering matters

`route("out/:slug", ...)` is registered **before** `route(":slug?", ...)` in `app/routes.ts`. RR's route matching prefers more specific patterns, so `out/:slug` matches `/out/spotify` even though `:slug?` would also match the literal segment `out`. The order doesn't actually drive the match (specificity does), but listing more specific routes first is the convention.

### Query-string encoding

The button href uses `encodeURIComponent(source)`. Source is always a URL-safe slug (`instagram`, `direct`, etc.) per the `^[a-z0-9-]+$` slug pattern, so encoding is a no-op today — but it's defensive against future changes (e.g., if we ever generated source values from non-slug input).

### Vitest exclusions tightened

Vitest was scanning a stale `.claude/worktrees/jovial-mirzakhani-8ad401/` directory left over from a parallel Claude Code session, double-counting tests. Explicit `test.exclude` prevents this and a few other ambient dirs (`.git`, `.react-router`, `.wrangler`).
