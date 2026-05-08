# 02 — Source tracking

## Purpose

Wire the public page to know **where the visitor came from** based on the URL path. Each visit logs a `page_view` event capturing source, country, user agent, and referrer. The button matching the inbound source is moved to the **last** position (visitor already came from there — deprioritize).

| URL | source | raw_path | Reorder? |
|---|---|---|---|
| `/` | `direct` | `null` | No |
| `/instagram` (matches enabled link slug) | `instagram` | `null` | Instagram → last |
| `/whatever` (no match) | `direct` | `"whatever"` | No |

## Files

### App code
- `app/lib/source-resolution.ts` — already existed from Feature 00; unchanged. `resolveSource(rawSlug, validSlugs)` → `{ source, rawPath }`.
- `app/lib/source-resolution.test.ts` — already existed; unchanged.
- `app/lib/source-reorder.ts` — **new**. `reorderForSource<T extends { slug }>(links, source)` returns a new array with the matching link pushed to the end. No-op for `direct` or unknown sources.
- `app/lib/source-reorder.test.ts` — **new**. 6 cases: direct, unknown, first/middle/last position match, no-mutation invariant.
- `app/lib/events.ts` — **new**. `logPageView({ db, source, rawPath, request })` writes to `events`. Reads `cf-ipcountry`, `user-agent`, `referer` from request headers; missing headers stored as `null`.
- `app/lib/events.test.ts` — **new**. 4 cases: basic page_view, header capture, missing-header → null, raw_path persistence.
- `app/routes.ts` — **modified**. Replaced `index("routes/home.tsx")` with `route(":slug?", "routes/home.tsx")`. Single optional-param route matches both `/` and `/:anything`.
- `app/routes/home.tsx` — **modified**. Loader now reads `params.slug`, calls `resolveSource` with the enabled slugs as the whitelist, calls `logPageView`, and reorders before returning.

### Docs
- `docs/02-source-tracking.md` — this file.

## Routes / Endpoints

| Path | Handler | Behavior |
|---|---|---|
| `/` | `home.tsx` loader | `source = direct`, `raw_path = null`. Logs page_view. Renders default order. |
| `/:slug` (matches enabled) | `home.tsx` loader | `source = slug`. Logs page_view. Reorders matching button to last. |
| `/:slug` (no match) | `home.tsx` loader | `source = direct`, `raw_path = slug`. Logs page_view. Renders default order. |

The `:slug?` optional segment matches both forms in a single route. **Multi-segment paths** (e.g., `/foo/bar`) do **not** match this route — they 404. That's fine for MVP; reserved paths (`/admin/**`, `/out/:slug`) will be added by their owning features and take precedence over this catch-all when present.

## Database

**Reads:** `links` (via `getEnabledLinks`, unchanged from Feature 01).

**Writes:** one row inserted into `events` per page load:
```sql
INSERT INTO events (type, source, raw_path, country, user_agent, referrer)
VALUES ('page_view', ?, ?, ?, ?, ?)
```
- `created_at` defaults to `CURRENT_TIMESTAMP` (schema default)
- `clicked_slug` is NULL for page_views (only set on link_clicks in Feature 03)
- `country` from `CF-IPCountry` header (Cloudflare auto-injects); NULL on localhost

No migrations added.

## Tests

- `app/lib/source-reorder.test.ts` — 6 pure-function cases
- `app/lib/events.test.ts` — 4 cases against real in-memory D1
- All 18 tests across the project pass.

The composed loader is **not** integration-tested. Per CLAUDE.md testing strategy, the parts are TDD'd; the loader is mostly composition. End-to-end behavior verified manually via `pnpm dev` + curl: `/`, `/instagram`, `/whatever` all behave correctly and the events table contains the expected rows.

## Dependencies

**Depends on:**
- [00-foundation](00-foundation.md) — `events` table, Drizzle, vitest pool-workers
- [01-public-page](01-public-page.md) — `getEnabledLinks`, the home route file

**Depended on by:**
- [03-outbound-tracking](03-outbound-tracking.md) — reuses `app/lib/events.ts` (adds `logLinkClick` alongside `logPageView`) and consumes the `source` value the home loader now emits, carrying it into button hrefs as `?source=:source`.
- 06-backoffice-analytics will aggregate `events.source`, `events.raw_path`, etc. *(not yet implemented)*

## Notes / Decisions

### Source whitelist = enabled link slugs

`resolveSource` is called with `new Set(links.map((l) => l.slug))` — the **enabled** links from D1. Disabled links don't grant their slug. Hitting `/instagram` while Instagram is disabled in the backoffice falls back to `direct` + `raw_path = "instagram"`.

### Loader writes to D1

The loader is no longer a pure read — it inserts a row before returning. This is acceptable: in React Router, loaders may have side effects, and analytics writes are idempotent in spirit (each visit is its own row). If the insert ever throws, the page won't render — failures here would be a user-visible issue. **Considered for later:** wrapping the insert in a try/catch with a `console.error` so analytics failures don't crash rendering. Deferred until we see it happen.

### Reorder also runs for unknown slugs

Technically `reorderForSource(links, "direct")` is a no-op. Calling it unconditionally simplifies the loader — no branching in the route handler. The function defends against unknown sources too (`findIndex === -1` returns input unchanged).

### `:slug?` optional segment

React Router's path-to-regexp syntax supports `?` for optional segments. `:slug?` matches both `/` and `/anything`. We could have written two route entries (`index(...)` + `route(":slug", ..., { id })`) instead — the `?` form is shorter and avoids the route-id deduplication dance.

### Nothing visual changes for the source-platform button

Per CLAUDE.md spec discussion: position only, no visual treatment. The button appears with the same styling as the others, just last in the list.
