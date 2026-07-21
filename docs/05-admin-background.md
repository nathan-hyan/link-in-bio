# 05 — Admin background setting

## Purpose

Let the admin change the background image of the public page from the backoffice without redeploying. First (and so far only) entry under a generic key/value `settings` table — additional site-wide settings can be added the same way later.

> **Update (2026-05, background image upload):** `/admin/settings` no longer takes a pasted URL. The admin now **uploads an image file**, stored in Workers KV under a single fixed key; the public page's `bg_image_url` setting points at a same-origin route (`/media/bg?v=<ts>`) that streams it. Uploading again overwrites the same KV key, so only one background ever exists (old bytes deleted). See the "Background image upload (KV)" section under Notes for the full design.

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
- `app/routes/admin.settings.tsx` — **new**; **rewritten 2026-05 to upload-only**. Loader returns the current `bgImageUrl` (rendered as a preview). Action reads a `multipart/form-data` file field `bgImageFile`, validates it via `validateImageUpload`, `put`s the bytes to KV under `BG_KV_KEY`, and sets `bg_image_url` to `/media/bg?v=<Date.now()>`. Component is a `<Form method="post" encType="multipart/form-data">` with a preview image, a file input, help text, error/success message, and an Upload button that disables during submission via `useNavigation`.
- `app/routes/admin.tsx` — **modified**. Adds a `Settings` link to the admin nav.
- `app/routes.ts` — **modified**. Registers `route("settings", "routes/admin.settings.tsx")` as a child of the admin parent, and (2026-05) `route("media/bg", "routes/bg-image.tsx")` before the `:slug?` catch-all.

### Background image upload (added 2026-05)
- `app/lib/media-upload.ts` — **new**. `validateImageUpload({ contentType, size })` → error string | null (image types only, ≤ 5 MB). Exports `BG_KV_KEY` (`"background"`), `BG_IMAGE_PATH` (`/media/bg`), `MAX_UPLOAD_BYTES`, `ALLOWED_IMAGE_TYPES`.
- `app/lib/media-upload.test.ts` — **new**. 5 cases: valid types, empty file, non-image type, over-limit, exactly-at-limit.
- `app/routes/bg-image.tsx` — **new**. Resource route (loader only) at `/media/bg`. Reads the KV object with `getWithMetadata` (arrayBuffer), returns it with the stored `Content-Type` and `Cache-Control: public, max-age=31536000, immutable`. 404 if no image uploaded yet.
- `wrangler.jsonc` — **modified**. Adds the `MEDIA` KV namespace binding (id `0062cd6b0f824db3be2bf8bd1f6ba6e9`, namespace `hyan-linkbio-media`).

### Docs
- `docs/05-admin-background.md` — this file.

## Routes / Endpoints

| Path | Method | Behavior |
|---|---|---|
| `/admin/settings` | GET | Loader returns the current `bg_image_url`, shown as a preview image. CF Access required. |
| `/admin/settings` | POST | `multipart/form-data` upload. Validates the `bgImageFile` field, `put`s it to KV, sets `bg_image_url = /media/bg?v=<ts>`. Returns `{ ok: true }` or `{ error }`. CF Access required. |
| `/media/bg` | GET | Streams the uploaded image from KV with its stored content-type + immutable cache headers. 404 if none uploaded. **Public** (not under `/admin`). |
| `/` | GET | Loader calls `getBgImageUrl(db)`; the component uses the returned URL (now typically `/media/bg?v=<ts>`). The frosted-glass card is unaffected. |

## Database

**Reads:** `getSetting(db, 'bg_image_url')` from the public page loader.
**Writes:** `setSetting(db, 'bg_image_url', value)` from the admin action.

Migration `0001_glossy_golden_guardian.sql` adds the table. No FK to other tables.

**KV (added 2026-05):** the image *bytes* live in the `MEDIA` KV namespace under the single key `background` (value = arrayBuffer, metadata = `{ contentType }`), written by the upload action and read by `/media/bg`. D1 still only stores the *URL string* in `bg_image_url`.

## Tests

`app/lib/settings.test.ts` — 7 cases against real in-memory D1, covering both the generic helpers and the `getBgImageUrl` shortcut. All cases pass.

`app/lib/media-upload.test.ts` (added 2026-05) — 5 cases for `validateImageUpload`. The upload round-trip (POST file → KV `put` → `GET /media/bg` returns identical bytes with the right content-type) is **not** unit-tested; verified manually against `wrangler dev` (miniflare's local KV): 69-byte PNG uploaded, served back byte-identical with `Content-Type: image/png` and immutable cache headers, and the public page picked up `/media/bg?v=<ts>`.

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

### Background image upload (KV) — added 2026-05

The admin uploads a file instead of pasting a URL. Design choices:

- **KV over R2.** For one small image, Workers KV needs no payment method (R2 requires a card on the account even for $0 free-tier usage). Single fixed key `background`; free tier (1 GB / 100k reads-a-day) is ample.
- **Overwrite = delete.** Requirement was "old image removed when replaced." A `kv.put` to the same key replaces the bytes — only one object ever exists, no explicit delete or cleanup job needed.
- **Served through the Worker, not a public bucket URL.** `/media/bg` (a resource route) streams the KV object same-origin. No public-bucket DNS/custom-domain setup, and it keeps working if we ever swap KV for R2.
- **Cache-busting via the stored URL.** `bg_image_url` is set to `/media/bg?v=<Date.now()>` on every upload. The bytes at any given `?v` never change, so `/media/bg` returns `Cache-Control: immutable` and the CDN/browser caches aggressively; a new upload changes `?v` and forces a refetch.
- **`/media/bg` path, not `/bg`.** A single-segment `/bg` would be swallowed by the `:slug?` catch-all (and pollute the slug namespace); the two-segment `media/bg` can't match `:slug?` and needs no reserved-slug entry.
- **Validation lifted to `app/lib/media-upload.ts`** (unlike the old inline URL validator) so it's unit-tested per the CLAUDE.md TDD rule.
- **Upload-only UI.** The pasted-URL field was removed. Trade-off: no more pointing at an external URL or resetting to `/bg.png` from the UI. Re-uploading is the only way to change the background now; acceptable for the single-admin flow.

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
