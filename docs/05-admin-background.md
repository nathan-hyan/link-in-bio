# 05 — Admin background setting

## Purpose

Let the admin change the background image of the public page from the backoffice without redeploying. First (and so far only) entry under a generic key/value `settings` table — additional site-wide settings can be added the same way later.

## Files

### Schema / migrations
- `app/db/schema.ts` — **modified**. Added `settings` table: `key TEXT PRIMARY KEY`, `value TEXT NOT NULL`, `updated_at` (default `CURRENT_TIMESTAMP`). Exports `Setting` type.
- `drizzle/0001_glossy_golden_guardian.sql` — generated migration creating the table.
- `seed.sql` — adds `INSERT OR IGNORE INTO settings (key, value) VALUES ('bg_image_url', '/bg.png')` so a fresh install has a sensible default before anyone visits the admin.

### App code
- `app/lib/settings.ts` — **new**. Three functions:
  - `getSetting(db, key) → string | null`
  - `setSetting(db, key, value)` (upsert via `onConflictDoUpdate`, refreshes `updated_at`)
  - `getBgImageUrl(db) → string` — convenience wrapper. Returns `DEFAULT_BG_IMAGE_URL` (`/bg.png`) when the row is absent or stored as an empty string.
  - Exports the constants `SETTING_BG_IMAGE_URL` and `DEFAULT_BG_IMAGE_URL`.
- `app/lib/settings.test.ts` — **new**. 7 cases against real D1: missing key → null, roundtrip, upsert overwrites, key isolation, default fallback for `getBgImageUrl`, stored value used, empty-string falls back to default.
- `app/routes/home.tsx` — **modified**. Loader fetches `getEnabledLinks` and `getBgImageUrl` in parallel via `Promise.all`. Returns `bgImageUrl` alongside `links` and `source`. Component uses `style={{ backgroundImage: \`url('${bgImageUrl}')\` }}` instead of the hardcoded path.
- `app/routes/admin.settings.tsx` — **new**. Loader returns the current `bgImageUrl`. Action validates the submitted URL (see below) and calls `setSetting`. Component is a `<Form method="post">` with one labeled text input, an inline help string, an error/success message, and a Save button that disables itself during submission via `useNavigation`.
- `app/routes/admin.tsx` — **modified**. Adds a `Settings` link to the admin nav.
- `app/routes.ts` — **modified**. Registers `route("settings", "routes/admin.settings.tsx")` as a child of the admin parent.

### Docs
- `docs/05-admin-background.md` — this file.

## Routes / Endpoints

| Path | Method | Behavior |
|---|---|---|
| `/admin/settings` | GET | Loader returns the current `bg_image_url`. Renders the form pre-filled with the current value. CF Access required. |
| `/admin/settings` | POST | Action validates the form, calls `setSetting('bg_image_url', value)`, returns `{ ok: true }` on success or `{ error, value }` on failure. CF Access required. |
| `/` | GET | Loader now also calls `getBgImageUrl(db)` and the component uses the returned URL. The frosted-glass card from the prior PR is unaffected. |

## Database

**Reads:** `getSetting(db, 'bg_image_url')` from the public page loader.
**Writes:** `setSetting(db, 'bg_image_url', value)` from the admin action.

Migration `0001_glossy_golden_guardian.sql` adds the table. No FK to other tables.

## Tests

`app/lib/settings.test.ts` — 7 cases against real in-memory D1, covering both the generic helpers and the `getBgImageUrl` shortcut. All cases pass.

The route loader/action wiring is **not** integration-tested — it's a thin compose of `getBgImageUrl` and `setSetting`, both of which are covered. Action validation logic is currently not unit-tested separately because it lives inline in the route file. **Acceptable trade-off for MVP** (~15 lines of pure logic that's easy to read at a glance). If we ever extend it materially, lift it into `app/lib/settings-validation.ts` with its own tests.

End-to-end verified locally:
- Default `/bg.png` shows when no value stored.
- `POST /admin/settings` with `https://example.com/bg.jpg?v=1&size=large` → public page picks it up.
- Invalid inputs rejected with form errors:
  - Empty string → "Background URL cannot be empty."
  - `javascript:alert(1)` → "URL must start with /, http://, or https://."
  - URL containing `'`, `"`, `<`, `>`, `\`, or whitespace → "URL contains disallowed characters…"
- Valid URLs with query strings, multiple `&` params, are accepted and HTML-escaped on render (`&` → `&amp;`, `'` → `&#x27;`).

## Dependencies

**Depends on:**
- [00-foundation](00-foundation.md) — schema, Drizzle, migrations, vitest pool-workers
- [01-public-page](01-public-page.md) — the home loader/component this feature extends
- [04-backoffice-auth](04-backoffice-auth.md) — the `/admin/*` layout and CF Access gate

**Depended on by:**
- 06-backoffice-links and 07-backoffice-analytics will reuse the same admin form pattern (`Form method="post"` + action + `useNavigation`).

## Notes / Decisions

### Key/value table vs purpose-built columns

Rejected: a singleton `site_config` row with one column per setting. Picked: generic `settings` key/value because adding new settings (favicon URL, OG image URL, custom CSS, etc.) becomes one INSERT and one `getSetting`/`setSetting` call — no migration. The cost (no per-key typing) is negligible at this scale; settings are read at most once per request.

### URL validation: defensive, not exhaustive

The action accepts URLs that:
1. Start with `/`, `http://`, or `https://`.
2. Are ≤ 2000 chars.
3. Contain no `'`, `"`, `<`, `>`, `\`, or whitespace.

(3) exists because the URL is interpolated into a CSS `background-image: url('…')` value on the public page. Without it, a malicious URL could in principle escape the string and inject CSS. Since `/admin/settings` is gated by Cloudflare Access (only the admin can write), the realistic attacker surface is "the admin attacking themselves" — but cheap defense is cheap defense. Legitimate image URLs encode whitespace and quotes anyway.

### `getBgImageUrl` empty-string fallback

If the admin somehow saves an empty string (shouldn't happen — empty is rejected by the action — but if a row gets there via a wrangler exec), the public page falls back to `/bg.png` rather than producing a broken `url('')`. Belt and suspenders.

### URL stored as-is, not validated against a fetch

We don't HEAD the URL to confirm it's a real image. The admin is the only one writing this value, and they can immediately verify by looking at the public page. Over-validation would prevent legit flows like "I'm uploading the image to my CDN right now and will paste the URL once it's up; it's not reachable yet."

### No rollback button in the UI

If the admin pastes a broken URL, the public page renders with a missing background but **does not 503** (the loader doesn't throw — it just gets a non-resolving URL). The admin can re-open `/admin/settings` and reset to `/bg.png`. Adding a "Reset to default" button is a nice-to-have; deferred.

### Where will future settings live

Same form, more inputs. When this grows beyond ~5 settings, group them into sections under `<fieldset>` (Visual / SEO / Behavior / etc.) and possibly split into multiple admin pages. Not a problem yet.
