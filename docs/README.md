# docs/

Living documentation for each feature. **Read first, edit alongside, keep current.**

The files here are the source of truth for design intent, file ownership, routes, schema impact, and test coverage. Any agent (or human) picking up work on this codebase should be able to read `CLAUDE.md` + this folder and have full context.

> **First time here?** Open [STATUS.md](STATUS.md) — it lists what's currently shipped, what's next on the to-do list, and known quirks.

## Rules

1. **Before changing a feature**, read its doc + any docs it depends on.
2. **As part of the change**, update the doc — new files, removed files, new routes, new tests, changed dependencies.
3. **Out-of-date docs are a bug.** A PR that changes feature behavior without updating the doc should not merge.
4. **No stale TODOs.** If a TODO/Notes item is resolved, delete it. The doc reflects the current state, not history.

## Naming

- `NN-feature-slug.md` where `NN` is a zero-padded sequence (`00`, `01`, ...).
- Sequence reflects build order and rough dependency direction.

## Template

Every feature doc uses this structure:

```markdown
# [Feature name]

## Purpose
What this feature does (user-facing).

## Files
List of all files this feature owns or touches, with one-line purpose each.

## Routes / Endpoints
Path → handler → behavior.

## Database
Tables, columns, queries this feature reads/writes.

## Tests
Test files + what they cover.

## Dependencies
Other features this depends on, other features that depend on this.

## Notes / Decisions
Anything non-obvious for future-me reading this cold.
```

## Index

- [`STATUS.md`](STATUS.md) — **Current state + remaining to-do + known quirks.** Read this first.
- [`00-foundation.md`](00-foundation.md) — Project scaffold, tooling, configs, first deploy
- [`01-public-page.md`](01-public-page.md) — Public page rendering from D1
- [`02-source-tracking.md`](02-source-tracking.md) — Inbound `/:slug?` route, source resolution, `page_view` events
- [`03-outbound-tracking.md`](03-outbound-tracking.md) — `/out/:slug` redirect handler, `link_click` events
- [`04-backoffice-auth.md`](04-backoffice-auth.md) — Cloudflare Access wiring on `/admin/**`
- [`05-admin-background.md`](05-admin-background.md) — `settings` table + `/admin/settings`, public page reads bg URL from D1
- [`06-backoffice-links.md`](06-backoffice-links.md) — Link CRUD UI at `/admin`
- [`07-backoffice-analytics.md`](07-backoffice-analytics.md) — Analytics dashboard at `/admin/analytics`
