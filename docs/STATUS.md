# Project status & to-do

> **For new agents picking this up:** read [CLAUDE.md](../CLAUDE.md) (workflow + spec), then this file for current state and remaining work, then the relevant `docs/NN-*.md` for any feature you touch. Don't forget the GitHub-account rule (use `nathan-hyan`, never the MasterClass account — see project memory).

Last updated: 2026-05-14

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
| 05 | [Admin background setting](05-admin-background.md) — generic `settings` table + `/admin/settings`, public page reads `bg_image_url` from D1. **Background image is now uploaded** (multipart) to Workers KV (`MEDIA` binding, key `background`) and served at `/media/bg?v=<ts>`; re-upload overwrites (old image deleted). | ✅ shipped |
| 06 | [Backoffice link CRUD](06-backoffice-links.md) — `/admin` table with add / edit / reorder / toggle / delete; last-link guard, reserved-slug guard | ✅ shipped |
| 07 | [Backoffice analytics](07-backoffice-analytics.md) — `/admin/analytics` Recharts dashboard; date range, headline numbers, time series, sources, destinations, source × destination matrix, top countries | ✅ shipped |
| — | Hard-gate on `/admin/**` — loader in `app/routes/admin.tsx` returns 401 in production when the `Cf-Access-Jwt-Assertion` header is absent (defense-in-depth safety net if the dashboard Access policy drifts; localhost skips) | ✅ shipped |
| — | Public page visual refresh — 2025 White Stroke logo, tightened logo box, vertically stacked buttons, `busqueda` background (`public/lib_bg_busqueda.png`) | ✅ shipped |
| — | Bot/scanner analytics filter — `app/lib/page-view-filter.ts` skips logging scanner probes (`.env`, `config.json`, …) and bot user-agents; `public/robots.txt` added. See [02-source-tracking](02-source-tracking.md). Edge rules (Bot Fight Mode + WAF) still to be enabled in the CF dashboard | ✅ shipped (app-level) |

**MVP complete.** Only the post-MVP punch list (OG image, favicon) remains from the original CLAUDE.md spec.

**Operational state:**
- D1 prod database `hyan-linkbio` (id `fbe6a12c-dc63-4898-ad08-45791264647a`)
- KV namespace `hyan-linkbio-media` (id `0062cd6b0f824db3be2bf8bd1f6ba6e9`, binding `MEDIA`) — holds the uploaded background image under key `background`
- Migrations applied; seed populated the 5 starting platforms
- `CLOUDFLARE_API_TOKEN` is in repo secrets (Edit Cloudflare Workers preset + D1 Edit)
- CI auto-deploys on push to `main` via `wrangler deploy`

---

## To do — remaining MVP features

**MVP complete.** All seven features from the original spec are shipped. The next thing to ship is in the post-MVP punch list below.

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
