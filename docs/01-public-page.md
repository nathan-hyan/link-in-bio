# 01 — Public page

## Purpose

Render the public landing at `/` from D1: logo, tagline, and one button per enabled link in `position` order. Returns **503** if zero links are enabled (per CLAUDE.md spec — the page is broken without buttons, signal it loudly).

This feature delivers the read path. Source-aware reordering and `?source=` URL annotation are added in [Feature 02](02-source-tracking.md); button hrefs are routed through `/out/:slug` in [Feature 03](03-outbound-tracking.md). The descriptions below reflect what Feature 01 owned at the time it was built — see those follow-up docs for current button rendering behavior.

## Files

### App code
- `app/lib/links.ts` — `getEnabledLinks(db: Db): Promise<Link[]>` returning enabled links sorted by `position` ASC. Single Drizzle query.
- `app/lib/links.test.ts` — 4 cases: empty DB, all disabled, mixed (filters disabled), correct ordering by position
- `app/routes/home.tsx` — adds `loader` (calls `getEnabledLinks`, throws 503 when empty) and renders the buttons via `loaderData.links`. Replaces the placeholder from Feature 00.

### Test infrastructure (added in this feature, used by all D1-touching tests going forward)
- `vitest.config.ts` — switched to `defineWorkersConfig(async () => ...)` to read migrations at config time. Added `setupFiles: ['./test/apply-migrations.ts']`, `isolatedStorage: true`, and `bindings: { TEST_MIGRATIONS }` exposing the migration array to tests.
- `test/apply-migrations.ts` — runs once per test worker via top-level `await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)`. Declares `ProvidedEnv` so `env.DB` is typed. **Schema is applied; data is not.** Tests insert their own fixtures.
- `tsconfig.cloudflare.json` — added `@cloudflare/vitest-pool-workers` to `compilerOptions.types`, added `test/**/*` to `include`. `cloudflare:test` module is now resolvable everywhere.

### Docs
- `docs/01-public-page.md` — this file

## Routes / Endpoints

| Path | Loader | Component | Behavior |
|---|---|---|---|
| `/` | reads `links` from D1 via `getEnabledLinks` | `<Home>` renders logo + tagline + button list | 200 HTML when ≥1 enabled link; **throws Response 503** when zero |

The loader receives the D1 binding via `context.cloudflare.env.DB`, declared in `workers/app.ts` (`AppLoadContext`).

## Database

**Reads:** `SELECT * FROM links WHERE enabled = true ORDER BY position ASC`. Equivalent Drizzle:
```ts
db.select().from(links).where(eq(links.enabled, true)).orderBy(asc(links.position))
```

**Writes:** none.

No migrations added in this feature.

## Tests

- `app/lib/links.test.ts` (4 tests, all run against real in-memory D1):
  1. Returns `[]` when there are no rows
  2. Returns `[]` when all rows have `enabled = false`
  3. Returns only `enabled = true` rows
  4. Orders results by `position` ascending

`beforeEach` deletes all rows to isolate cases. The schema is applied once per worker by `test/apply-migrations.ts` (top-level await in setup file).

UI rendering is **not unit-tested** (per the testing strategy in CLAUDE.md — Recharts/UI shells are out of TDD scope). Verified manually via `pnpm dev` + `curl localhost:5173/` after seeding the local D1.

## Dependencies

**Depends on:**
- 00-foundation — schema, Drizzle client, seed, public assets, vitest pool-workers setup

**Depended on by:**
- [02-source-tracking](02-source-tracking.md) — extended the home loader to resolve a source slug from `params.slug` and reorder the matching button to last
- [03-outbound-tracking](03-outbound-tracking.md) — replaced the direct button hrefs with `/out/:slug?source=:source`

## Notes / Decisions

### Empty state = 503, not graceful

If no links are enabled the loader throws `new Response(null, { status: 503 })`. Per spec: the page is broken without buttons — signaling 503 surfaces it to anyone watching uptime. The backoffice last-link guard (Feature 05) prevents the user from reaching this state through normal use. **No event is logged on the 503 path** (a broken render isn't meaningful analytics).

### Buttons originally linked directly to the destination

This feature shipped buttons as `<a href={link.url} target="_blank">`. Feature 03 swapped this for `/out/:slug?source=:source` so clicks go through the redirect handler and get logged. The route file `app/routes/home.tsx` therefore now bears multi-feature ownership; current button-rendering behavior lives in [03-outbound-tracking.md](03-outbound-tracking.md).

### Test isolation strategy

`isolatedStorage: true` in the workers pool config makes Miniflare roll back D1 changes between tests inside the same file. Combined with explicit `beforeEach` (delete from links), every test starts from a clean schema. No global teardown needed.

### vitest config went async

`defineWorkersConfig` accepts a sync object, a Promise, or a function returning either. We switched to a function so `await readD1Migrations(...)` can run at config-load time. The same pattern will be reused if other tables need fixture migrations.

### Coverage exclusion update

The test file `app/lib/links.test.ts` is excluded from coverage along with the existing `*.test.{ts,tsx}` and `+types/**` exclusions in `vitest.config.ts`. No change needed — the existing glob already covers it.
