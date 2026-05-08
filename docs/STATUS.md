# Project status & to-do

> **For new agents picking this up:** read [CLAUDE.md](../CLAUDE.md) (workflow + spec), then this file for current state and remaining work, then the relevant `docs/NN-*.md` for any feature you touch. Don't forget the GitHub-account rule (use `nathan-hyan`, never the MasterClass account — see project memory).

Last updated: 2026-05-08

---

## Currently shipped

Live at https://link-in-bio.hyan.dev (custom domain attached) and https://hyan-link-in-bio.exequiel-ml.workers.dev (workers.dev fallback).

| # | Feature | Status |
|---|---|---|
| 00 | [Foundation](00-foundation.md) — RR7 + Vite + Tailwind + TS, Workers + D1, Drizzle, Vitest pool-workers, GH Actions CI/CD | ✅ shipped |
| 01 | [Public page](01-public-page.md) — renders enabled links from D1 in `position` order; HTTP 503 if zero | ✅ shipped |
| 02 | [Source tracking](02-source-tracking.md) — `/:slug?` resolves source via whitelist, logs `page_view`, reorders matching button last | ✅ shipped |
| 03 | [Outbound tracking](03-outbound-tracking.md) — `/out/:slug` logs `link_click` then 302s; 404 if missing/disabled | ✅ shipped |
| 04 | [Backoffice auth](04-backoffice-auth.md) — `/admin/**` route shells + Cloudflare Access policy at the edge | ✅ shipped |
| — | Frosted-glass card around the public page content (small UI polish) | ✅ shipped |
| 05 | [Admin background setting](05-admin-background.md) — generic `settings` table + `/admin/settings` form, public page reads `bg_image_url` from D1 | ✅ shipped |

**Operational state:**
- D1 prod database `hyan-linkbio` (id `fbe6a12c-dc63-4898-ad08-45791264647a`)
- Migrations applied; seed populated the 5 starting platforms
- `CLOUDFLARE_API_TOKEN` is in repo secrets (Edit Cloudflare Workers preset + D1 Edit)
- CI auto-deploys on push to `main` via `wrangler deploy`

---

## To do — remaining MVP features

In dependency order. Each is one PR cycle (branch `feat/NN-name`, TDD where it fits, doc updated alongside, PR for the React parts).

### Next up: 06 — Backoffice link CRUD

**Goal:** the admin can add, edit, reorder, enable/disable, and delete links from `/admin`.

**Code surface:**
- `app/routes/admin._index.tsx` — replace the placeholder with the full table view of all links (enabled + disabled): slug, label, URL, position, toggle, edit, delete.
- Up/down arrows for ordering (no drag-and-drop in MVP — defer).
- "Add link" form with auto-suggested slug from label, slug uniqueness validation, slug pattern `^[a-z0-9-]+$`.
- Edit via modal.
- Action handler module (`app/lib/admin-links.ts` or similar) covering: create, update (incl. enabled toggle), delete, swap-positions.
- **Last-link guard** (already specced in CLAUDE.md): action returns 422 if disable/delete would leave zero enabled links (would 503 the public page).
- **Reserved-slug guard:** the create/update action must reject slugs that collide with literal admin or system routes — at minimum `admin`, `out`, `api`, `settings`. Document in the feature doc.

**Tests:**
- TDD on action handlers (real D1):
  - create with valid input
  - create rejects duplicate slug
  - create rejects invalid slug pattern
  - create rejects reserved slugs (`admin`, `out`, `api`, `settings`)
  - update enables/disables
  - delete removes the row
  - delete rejected (422) when target is the last enabled link
  - disable rejected (422) when target is the last enabled link
  - swap-positions changes ordering as expected

**UI considerations:**
- This is the most React-heavy feature. PR review surface is bigger.
- Reuse the Feature 05 form pattern (`<Form method="post">` + action + `useNavigation`).

---

### 07 — Analytics dashboard

**Goal:** at `/admin/analytics`, surface what's happening: views, clicks, sources, destinations, geography.

**Code surface:**
- `app/routes/admin.analytics.tsx` — loader runs all the aggregations against D1 and returns shaped data
- Recharts components (admin bundle only — route-based code splitting handles this automatically)
- `app/lib/analytics.ts` (or similar) — pure aggregator functions that take the raw event rows and return the dashboard shapes

**Layout per CLAUDE.md spec:**
- Date range selector (7d / 30d / 90d / all) — three preset buttons
- Headline numbers (top of page): page views, link clicks, CTR
- Recharts **time-series line chart** (top): views & clicks, daily buckets
- Recharts **horizontal bar charts**: sources, destinations
- **Source × destination matrix** (table, not heatmap chart — easier to read at this size)
- **Countries table** — top 10 by page_view count

**Tests:**
- TDD on the aggregator functions in `app/lib/analytics.ts`:
  - bucket events by day for the time series
  - count by source / by destination
  - cross-tab source × destination
  - country tally
  - filter by date range
- Each function takes event rows (or accepts a `Db` and date range) and returns shaped data. Easy to unit-test against fixtures.

**Performance:** all queries run live against D1 on each dashboard load. With expected traffic, every query should finish well under 50ms.

---

## Post-MVP punch list

(carried from [CLAUDE.md](../CLAUDE.md))

- [ ] **OG image** — 1200×630 social-preview card. Currently no `og:image`, so DM previews fall back to favicon (which is also missing).
- [ ] **Favicon set** — generate from `public/hyan_logo.svg` via realfavicongenerator.net or similar.

Optional later:
- Backups: `wrangler d1 export` periodically, store the dump somewhere.
- Drag-and-drop ordering in the backoffice (currently up/down arrows only — defer until you actually have many links).
- Custom date range in analytics (currently presets only).
- Time-series buckets at finer granularity than daily.
- CSV export of events.
- Auto-deploy of dependabot dep bumps after CI passes.

---

## Known quirks & workarounds

These are documented inline in CLAUDE.md / 00-foundation.md but collected here for quick reference.

### Corepack signing-key bug (Node ≤22.x bundled corepack)
**Symptom:** `pnpm <anything>` errors with `Error: Cannot find matching keyid: ...`. Affects `pnpm wrangler ...` too.
**Fix:** `npm install -g corepack@latest`.
**Why:** the corepack that ships with older Node 22 has hardcoded signing keys that don't match newer pnpm signing keys.

### Rolldown native bindings pinned manually
`@rolldown/binding-darwin-arm64@1.0.0-rc.17` and `@rolldown/binding-linux-x64-gnu@1.0.0-rc.17` are direct devDependencies because pnpm 9 doesn't reliably install rolldown's `optionalDependencies`. Per-platform `os`/`cpu` fields cause pnpm to skip the wrong-arch one at install time, so both can coexist in `package.json`.
**Bump in lockstep with `rolldown` itself** when it releases. If a future pnpm release fixes optional-deps installation, drop both pins and the `pnpm.supportedArchitectures` block in `package.json`.

### `pnpm deploy` ≠ `pnpm run deploy`
`pnpm deploy` is a built-in pnpm command (for workspaces). It does NOT run our `package.json::scripts.deploy`. Always use `pnpm run deploy`. CI yaml is correct; document and shell aliases should be too.

### Stale Claude Code worktrees
If a parallel Claude Code session leaves an isolated worktree under `.claude/worktrees/<some-id>/`, vitest can pick up its test files and double-count. Mitigated by `test.exclude` in `vitest.config.ts` and `.gitignore`. Safe to `rm -rf` orphan worktrees only after `git worktree remove --force` (otherwise `git worktree prune` will catch them later).

---

## Commands cheatsheet

```bash
pnpm dev                  # local dev server (with miniflare D1)
pnpm test                 # vitest run
pnpm test:watch           # vitest watch
pnpm test:coverage        # vitest with coverage report
pnpm typecheck            # wrangler types + RR typegen + tsc -b
pnpm build                # production build (no upload)
pnpm db:generate          # generate Drizzle migration from schema diff
pnpm db:migrate:local     # apply migrations to local D1
pnpm db:migrate:prod      # apply migrations to prod D1
pnpm db:seed:local        # idempotent seed (local)
pnpm db:seed:prod         # idempotent seed (prod)
pnpm run deploy           # build + wrangler deploy (used by CI)
```

Wrangler queries against prod D1 (handy for spot-checks):

```bash
pnpm wrangler d1 execute hyan-linkbio --remote --command "SELECT type, source, raw_path, clicked_slug, country FROM events ORDER BY id DESC LIMIT 20"
```
