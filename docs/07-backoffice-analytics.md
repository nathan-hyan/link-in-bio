# 07 — Backoffice analytics

## Purpose

Replace the `/admin/analytics` placeholder with the live dashboard. Surfaces:
- Headline numbers: page views, link clicks, click-through rate (CTR)
- Time-series line chart (page views & link clicks, daily buckets)
- Horizontal bar charts: sources, destinations
- Source × destination crosstab (table)
- Top 10 countries (table)

Date range selectable via `?range=` query param: `7d`, `30d` (default), `90d`, `all`. Re-running the loader on each change keeps the implementation stateless.

This feature **completes the MVP** described in CLAUDE.md. The only remaining items are the post-MVP punch list (OG image, favicon).

## Files

### App code
- `app/lib/analytics.ts` — **new**. Six DB query functions plus pure helpers:
  - `parseDateRange(input: string | null)` — narrows to `'7d' | '30d' | '90d' | 'all'`, defaults to `'30d'`.
  - `rangeToStartDate(range, now)` — returns `'YYYY-MM-DD'` for the lower bound, or `null` for `'all'`.
  - `getTotals(db, start)` → `{ pageViews, linkClicks }`
  - `getDailySeries(db, start)` — sparse array of `{ day, pageViews, linkClicks }`
  - `getSourceCounts(db, start)` — page_view counts grouped by source
  - `getDestinationCounts(db, start)` — link_click counts grouped by clicked_slug
  - `getSourceDestinationMatrix(db, start)` — link_click counts grouped by `(source, clicked_slug)`
  - `getCountryCounts(db, start, limit)` — page_view counts grouped by country (non-null only), capped by `limit`
  - `fillDailyGaps(sparse, start, end)` — pure helper: pads the sparse series with zero rows for missing days, inclusive on both ends. Lets the line chart draw a continuous x-axis.
- `app/lib/analytics.test.ts` — **new**. 25 cases against real in-memory D1: `parseDateRange` defaults, `rangeToStartDate` math at each preset, totals split by type, date filtering, source/destination/country grouping (page_view-only and link_click-only as appropriate), source-vs-destination separation, country null-filtering, limit, daily series shape, gap-filling at three boundary cases.
- `app/routes/admin.analytics.tsx` — **rewritten**. Loader runs all six aggregations in `Promise.all`, computes CTR (rounded to one decimal), fills daily gaps so the chart has a continuous x-axis. Component renders headline stat cards + line chart + two bar charts side-by-side + the matrix table + countries table. Each chart is wrapped in a `<ClientOnly>` shim (see Notes). `<DateRangeSelector>` is four `<NavLink>`s pointing at `?range=…`.

### Dependencies
- `recharts` — added as a runtime dep. Used only in `app/routes/admin.analytics.tsx`. Vite + RR's route-based code splitting puts it in the client chunk that loads only when the user navigates to `/admin/analytics`; the public-page bundle is unaffected.

### Docs
- `docs/07-backoffice-analytics.md` — this file.

## Routes / Endpoints

| Path | Method | Behavior |
|---|---|---|
| `/admin/analytics` | GET | Loader returns shaped data for the current range; component renders the dashboard. CF Access required. |
| `/admin/analytics?range=7d\|30d\|90d\|all` | GET | Same, with the range applied. Unknown values fall back to `30d`. |

No POST handlers — analytics is read-only.

## Database

**Reads (per dashboard load):** six `GROUP BY` queries against `events`. All filter to `date(created_at) >= date(?)` when `start` is non-null; when `start` is null (`all` range) the filter drops.

Day-granularity comparison via SQL `date()` on both sides handles the SQLite `CURRENT_TIMESTAMP` format (`YYYY-MM-DD HH:MM:SS`) consistently regardless of the literal we pass in (`YYYY-MM-DD` or full timestamp).

**Writes:** none. **Migrations:** none.

## Tests

- 25 cases in `app/lib/analytics.test.ts`, all green against in-memory D1. Covers each aggregation's correctness, type-discrimination (page_view-only vs link_click-only as appropriate), null filtering, limits, sorting, and the gap-filler.
- The route loader is **not** integration-tested — it's compose-of-tested-helpers + `Promise.all`. Verified manually via dev server: seeded a handful of varied events, confirmed totals, sources, destinations, matrix, and countries all rendered with correct numbers; checked `?range=7d`, `?range=all`.
- The chart components themselves are not tested — Recharts UI is out of TDD scope per CLAUDE.md.

Total project test count: **88**.

## Dependencies

**Depends on:**
- [00-foundation](00-foundation.md) — schema, Drizzle, vitest pool-workers
- [02-source-tracking](02-source-tracking.md) — produces the `page_view` rows that feed sources, daily series, countries
- [03-outbound-tracking](03-outbound-tracking.md) — produces the `link_click` rows that feed destinations, the matrix, and the link-click side of the daily series
- [04-backoffice-auth](04-backoffice-auth.md) — admin layout & CF Access policy

**Depended on by:** nothing (terminal feature in the MVP roadmap).

## Notes / Decisions

### DB-side aggregation, not "load-all-events-then-reduce"

Each visualization runs its own `GROUP BY` query. Pros: scales as the events table grows; D1 is fast at indexed scans; Workers don't have to ship row arrays around. Cons: six round trips per dashboard load. With expected traffic and `Promise.all`, all six finish in well under 50ms. If the events table ever grows large (post-MVP), individual indexes (`(type, created_at)`, `(type, source)`) would speed each one further.

### Date filtering at day granularity

The `created_at` column stores text timestamps (SQLite default `CURRENT_TIMESTAMP` produces `YYYY-MM-DD HH:MM:SS`). To compare against the dashboard's day-grain bound, we wrap both sides in SQL `date()`. Side benefit: events from "today" are included regardless of the time of day the dashboard is loaded.

`rangeToStartDate("7d", now)` returns the date 7 days before `now`. This is **inclusive** of the bound day in the SQL filter, so `7d` actually shows 8 days. For an MVP with no SLA on what "7 days" means precisely, this is fine.

### `ClientOnly` wrapper around `<ResponsiveContainer>`

Recharts' `<ResponsiveContainer>` measures its parent on mount. During SSR there's no DOM, so it logs `width(-1) and height(-1)` warnings every request. In production those warnings end up in `wrangler tail`. The `<ClientOnly>` shim defers chart mounting until after hydration:

```tsx
function ClientOnly({ children }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return <>{children}</>;
}
```

Cost: charts pop in after hydration instead of being part of the SSR HTML. For an authed admin dashboard with no SEO concern this is acceptable. **The numerical tables (matrix, countries) and stat cards are NOT wrapped** — they render normally during SSR so the page is useful immediately.

### Matrix as a table, not a heatmap

The source × destination crosstab is rendered as a plain HTML table with cell counts (zero counts dimmed to `text-gray-300`). A Recharts heatmap would need custom cell scaling, color ramps, and is awkward at small sizes (most artists have ≤10 platforms). The table reads instantly; tradeoffs at this scale favor it.

### CTR is page-view-derived, not session-derived

`CTR = link_clicks / page_views * 100` for the selected range. Caveat: a single visitor making N page views and clicking M times contributes N to the denominator and M to the numerator. There's no session deduplication. For a single-artist site where most "real" visitors view the page once and click at most once, this is close enough. If we ever want session CTR we'd need session IDs, which means a cookie, which means a consent banner, which means defer.

### Recharts bundle cost

Recharts adds ~150KB gzipped to the client bundle that loads on `/admin/analytics`. The public page (`/`, `/:slug`) does not load Recharts because of route-based code splitting. The SSR bundle includes Recharts (~316KB gzipped total) but is well under the 1 MiB Workers script size limit.

### Sparse vs filled daily series

`getDailySeries` returns sparse rows (one per day with at least one event). The loader fills the gaps via `fillDailyGaps` before passing to the chart. Pure helper, easy to test, keeps the SQL trivial.

### Why `Promise.all` for six queries

Six independent queries → fan-out via `Promise.all`. D1 supports concurrent queries on the same connection. Each query is small. End-to-end loader time is bounded by the slowest single query, not the sum.

### What's missing (deferred)

- **Per-day hover detail** beyond Recharts' default tooltip. Acceptable.
- **Custom date range** (calendar picker). The presets cover 95% of intent for an artist looking at their own analytics; defer until specifically asked.
- **Funnel visualization** (instagram → page_view → click → spotify). The matrix already shows the click side; combining with page-view rates would need session correlation which we don't have.
- **CSV export.** Listed as optional in [STATUS.md](STATUS.md).
- **Real-time view.** No event streaming; query each load.
