# Hy-An Link-in-Bio

A single-tenant link-in-bio site for the Hy-An music project, served from `link-in-bio.hyan.dev`. Public landing page with source tracking + a backoffice for link management and analytics.

---

## ⚠️ Critical rules (read before any action)

- **GitHub account:** ALWAYS use the `nathan-hyan` GitHub account. NEVER the `exequiel-mleziva` (MasterClass) account. Before every `gh` command, run `gh auth status` and confirm `Active account: true` is on `nathan-hyan`. Switch with `gh auth switch -u nathan-hyan` if not.
- **Living docs:** the source of truth for each feature's design, files, and connections lives in `docs/NN-feature.md`. ALWAYS read the relevant doc(s) first before changing a feature. ALWAYS update the doc as part of the same change. Out-of-date docs are a bug.
- **Onboarding contract:** any agent (or human) should be able to read this file + [`docs/STATUS.md`](docs/STATUS.md) + the relevant `docs/NN-*.md` for the feature being touched and have full context — no other files required for design intent. **Start at `docs/STATUS.md`** for current state and remaining to-do.

---

## Workflow

### Per feature
1. Read `CLAUDE.md` + the feature's `docs/NN-feature.md` (and any docs it depends on).
2. Apply the change with TDD where the layer fits (see Testing).
3. Update `docs/NN-feature.md` to reflect new files, routes, schema, dependencies.
4. Ship per PR routing rules below.

### PR routing
- **Direct push to `main` (no review):** migrations, schema files, `app/lib/**` pure logic, `app/db/**`, `wrangler.toml`, `drizzle.config.ts`, CI yaml, dev dependencies, pure-backend test files.
- **PR for review:** anything that adds/modifies a route file, component, layout, Tailwind class, or user-visible behavior — even if the same file also contains loader/action code.
- One feature = one PR cycle (where review is required). Mixed features (foundation work) split into a direct-push infra commit + a PR for any starter UI.

### Branches
- `main` is deployed.
- Feature branches named `feat/NN-feature-name` (e.g. `feat/05-backoffice-links`).

---

## Stack

- **Framework:** React Router v7 (framework mode), Vite, TypeScript
- **Styling:** Tailwind v4
- **Hosting:** Cloudflare Workers (Static Assets) at `link-in-bio.hyan.dev`
- **Database:** Cloudflare D1
- **ORM / migrations:** Drizzle ORM + Drizzle Kit
- **Auth (admin):** Cloudflare Access on `/admin/**` (zero auth code in app)
- **Charts:** Recharts (admin bundle only)
- **Tests:** Vitest with `@cloudflare/vitest-pool-workers` (runs against real in-memory D1)
- **Package manager:** pnpm

---

## Routes

| Path | Purpose |
|---|---|
| `/` | Public page, source = `direct` |
| `/:slug` | Public page; source = slug if matches an enabled link, else `direct` (raw slug logged) |
| `/out/:slug` | Logs `link_click`, 302 redirect to the link's URL; 404 on unknown slug |
| `/admin` | Link CRUD (CF Access required) |
| `/admin/analytics` | Analytics dashboard (CF Access required) |

**Reserved paths** (never treated as source slugs): `/admin`, `/out`, `/api`.

---

## Schema

### `links`
| Column | Type | Notes |
|---|---|---|
| `id` | integer PK | autoincrement |
| `slug` | text | unique; doubles as inbound source identifier and `/out/:slug` target. Pattern `^[a-z0-9-]+$` |
| `label` | text | display name on the button |
| `url` | text | destination URL |
| `position` | integer | ordering on the page |
| `enabled` | boolean | soft-disable without deleting |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

### `events` (append-only)
| Column | Type | Notes |
|---|---|---|
| `id` | integer PK | |
| `type` | text | `'page_view'` or `'link_click'` |
| `source` | text | `'instagram'`, `'direct'`, etc. (string copy of slug — no FK) |
| `raw_path` | text | the actual path requested if it didn't match an enabled slug |
| `clicked_slug` | text | set on `link_click` events |
| `country` | text | from Cloudflare `CF-IPCountry` header |
| `user_agent` | text | |
| `referrer` | text | from `Referer` header |
| `created_at` | timestamp | |

**No foreign keys from events to links.** Events are append-only history; if a link is renamed or deleted, history must not break or shift.

**No IPs stored.** Country only.

### `settings`
| Column | Type | Notes |
|---|---|---|
| `key` | text PK | e.g. `bg_image_url` |
| `value` | text | |
| `updated_at` | timestamp | refreshed on every upsert |

Generic key/value table for site-wide configuration. Currently used only for `bg_image_url` (changeable from `/admin/settings`); future settings (favicon URL, OG image URL, etc.) plug in the same way without migrations.

---

## Public page

- Reuses `public/bg.png` (background) and `public/hyan_logo.svg` (logo) — served as static assets at `/bg.png` and `/hyan_logo.svg`. "est. 1995" tagline preserved.
- Buttons rendered from `links` where `enabled = true`, ordered by `position`.
- **Source-platform reorder:** if the inbound source matches an enabled link slug, that button is moved to the LAST position (visually identical, just deprioritized — visitor already came from there).
- Mobile-first responsive. Heavy mobile traffic expected.
- **Empty state:** if zero links are enabled, return **HTTP 503**. Do NOT log a page_view event on the 503 path.
- `<title>`: `Hy-An | Link In Bio`
- `<meta name="description">`: `Hy-An — est. 1995. Listen, watch, follow.`
- OG image and favicon are **post-MVP punch list** (see bottom).

---

## Backoffice

### `/admin` — Link CRUD
- Table of all links (enabled + disabled), with: slug, label, URL, position, enabled toggle, edit, delete
- Reordering: up/down arrows (no drag-and-drop in MVP)
- Add link: form with slug (auto-suggested from label), label, URL. Slug uniqueness validated, slug pattern `^[a-z0-9-]+$`.
- Edit: modal (not inline)
- **Last-link guard:** action handler returns 422 if delete or disable would leave zero enabled links. Message: `Cannot disable the last enabled link — the public page would 503.`

### `/admin/analytics` — Dashboard
- **Date range selector:** presets `7d` / `30d` / `90d` / `all`. No custom range in MVP.
- **Headline numbers (top):** total page views, total link clicks, CTR (clicks ÷ views). All for selected range.
- **Time-series line chart (Recharts):** two lines — page views and link clicks, daily buckets.
- **Sources bar chart (Recharts, horizontal):** count per inbound source (`instagram`, `direct`, ...), sorted desc.
- **Destinations bar chart (Recharts, horizontal):** count per `clicked_slug`, sorted desc.
- **Source × destination matrix (table):** rows = sources, cols = destinations, cells = click counts.
- **Countries table:** top 10 countries by page_view count.
- All queries run live against D1 on each dashboard load. No materialized views or caches in MVP.

---

## Tracking semantics

### Inbound (page_view)
- Hit on `/` → `source = 'direct'`, `raw_path = ''`
- Hit on `/:slug` where slug matches an enabled link → `source = slug`, `raw_path = ''`
- Hit on `/:slug` where slug does NOT match (and isn't a reserved path) → `source = 'direct'`, `raw_path = slug`
- Reserved paths (`/admin`, `/out`, `/api`) are never treated as page_view events; they route to their handlers.
- Captures: `country` (CF-IPCountry), `user_agent`, `referrer`.

### Outbound (link_click)
- Buttons render as `<a href="/out/:slug?source=:source">` — the source from the page that rendered the button is carried in the query string so the redirect handler doesn't depend on the `Referer` header (which can be stripped).
- `/out/:slug` handler: looks up link by slug (enabled only) → logs `link_click` event with `clicked_slug` and `source` from the query → 302 redirect to the link's `url`. Returns 404 if slug unknown or disabled.
- Captures same context (country, user_agent, referrer) as page_view.

---

## Testing

- **Process:** TDD on layers where it fits. Test name describes a behavior the user or visitor would care about. Failing test first, then code.
- **TDD applies to:** `app/lib/**` (pure functions: slug parsing, source resolution, validation, CTR math, query builders), route loaders & actions, the `/out/:slug` redirect handler, backoffice action handlers (last-link guard, slug uniqueness).
- **TDD does NOT apply to:** Recharts visual output, framework entry files (`entry.server.tsx`, root layout), Tailwind classes, D1 migration SQL.
- **D1 in tests:** `@cloudflare/vitest-pool-workers` runs Vitest inside the Workers runtime with real in-memory D1. No mocking the binding.
- **Coverage gate:** 80% global, configured in `vitest.config.ts`. This is a *ratchet* (catches dead code), not a target.

---

## Deploy

- **Local dev:** `wrangler dev` runs Workers locally with a local D1 SQLite file.
- **Migrations:** `pnpm drizzle-kit generate` produces SQL; `wrangler d1 migrations apply hyan-linkbio` applies them.
- **Seed:** idempotent SQL (`INSERT OR IGNORE` on slug uniqueness) populates the 5 starting platforms (Instagram, YouTube, Apple Music, Bandcamp, Spotify). Safe to run on every deploy.
- **CI/CD:** GitHub Actions ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)).
  - On PR: `pnpm test` + `pnpm typecheck`
  - On merge to `main`: `pnpm db:migrate:prod` → `pnpm db:seed:prod` (idempotent) → `pnpm run deploy` (note: `pnpm run`, not `pnpm`, because `pnpm deploy` is a built-in command)
  - Cloudflare API token in repo secrets as `CLOUDFLARE_API_TOKEN`.
- **Repo:** `nathan-hyan/link-in-bio` (public).

---

## docs/ — feature index

(Each file uses the template in `docs/README.md`.)

- [`docs/STATUS.md`](docs/STATUS.md) — **Current state + remaining to-do + known quirks. Start here.**
- [`docs/00-foundation.md`](docs/00-foundation.md) — Project scaffold, tooling, configs, first deploy
- [`docs/01-public-page.md`](docs/01-public-page.md) — Public page rendering from D1
- [`docs/02-source-tracking.md`](docs/02-source-tracking.md) — Inbound `/:slug?` route, source resolution, page_view events
- [`docs/03-outbound-tracking.md`](docs/03-outbound-tracking.md) — `/out/:slug` redirect handler, link_click events
- [`docs/04-backoffice-auth.md`](docs/04-backoffice-auth.md) — Cloudflare Access wiring on `/admin/**`
- [`docs/05-admin-background.md`](docs/05-admin-background.md) — `settings` table + `/admin/settings`, public page reads bg URL from D1
- [`docs/06-backoffice-links.md`](docs/06-backoffice-links.md) — Link CRUD UI at `/admin`
- [`docs/07-backoffice-analytics.md`](docs/07-backoffice-analytics.md) — Analytics dashboard at `/admin/analytics`

---

## Post-MVP punch list

- [ ] OG image (1200×630) — currently no social preview card
- [ ] Favicon set generated from `public/hyan_logo.svg`
