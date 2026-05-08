# 06 — Backoffice link CRUD

## Purpose

Replace the `/admin` placeholder from Feature 04 with the full link-management UI: add, edit, reorder, enable/disable, and delete the buttons that show on the public page. All operations are gated by Cloudflare Access (Feature 04). Action logic is TDD'd against real D1; UI shells aren't unit-tested per CLAUDE.md.

## Files

### App code
- `app/lib/admin-links.ts` — **new**. Five exported functions, each returning `AdminLinkResult<T>` (`{ ok: true, data } | { ok: false, error, status }`):
  - `getAllLinks(db)` — all rows (enabled + disabled), sorted by `position` ASC
  - `createLink(db, { slug, label, url })` — validates inputs, auto-assigns position = max + 1, defaults `enabled = true`
  - `updateLink(db, id, partial)` — validates whichever fields are present, refreshes `updated_at`, enforces last-link guard on disable
  - `deleteLink(db, id)` — enforces last-link guard if the target was enabled
  - `moveLink(db, id, "up" | "down")` — swaps position with the neighbor; no-op at edges
  - Exports `RESERVED_SLUGS` (set: `admin`, `out`, `api`, `settings`)
- `app/lib/admin-links.test.ts` — **new**. 33 cases against real in-memory D1, covering all of: auto-position, slug pattern, reserved-slug rejection (one each via `it.each`), URL validation, slug uniqueness on create and on update (including the "no self-collision" case), label/url required, last-link guard for both `updateLink(enabled: false)` and `deleteLink`, allow-re-enable on the only-disabled case, allow delete of disabled link when zero enabled exist, move up/down semantics including edge no-ops, 404 for unknown ids.
- `app/routes/admin._index.tsx` — **rewritten**. Replaces the Feature 04 placeholder with:
  - **Loader**: `getAllLinks(db)` → `{ links }`
  - **Action**: dispatches by `intent` form field (`create | update | toggle | delete | moveUp | moveDown`) into the corresponding lib function. Uses RR's `data()` helper to set the response status from the lib's return value. Returns `{ ok: true, intent }` on success, `{ ok: false, intent, error }` on failure.
  - **Component**: `<AddLinkForm>` at the top, `<table>` of all links, optional `<EditModal>` triggered by per-row Edit button. Per-row controls: up/down arrows (disabled at edges), Enabled/Disabled toggle, Edit, Delete (with `window.confirm`).
  - Uses `useNavigation` for pending button states. `useEffect` closes the modal and resets the add form on a successful matching action.

### Routes
- `app/routes.ts` — unchanged from Feature 04. The new admin._index.tsx slots into the existing `route("admin", ..., [index("routes/admin._index.tsx"), ...])` block.

### Docs
- `docs/06-backoffice-links.md` — this file.
- `docs/STATUS.md` — Feature 06 marked shipped, Feature 07 (analytics) is next-up.
- `CLAUDE.md`, `docs/README.md` — index entries updated.

## Routes / Endpoints

| Path | Method | Handler | Behavior |
|---|---|---|---|
| `/admin` | GET | loader | Returns all links (enabled + disabled) sorted by position. CF Access required. |
| `/admin?index` | POST | action | Dispatches by `intent` form field. CF Access required. |

The `?index` query parameter is **required** on POSTs. RR's nested-route action resolution treats `/admin` (parent layout) and `/admin?index` (the index child) as different action targets; `?index` says "the action belongs to the index child". The forms in this route hardcode this — see Notes below.

## Database

**Reads:** `getAllLinks` runs `SELECT * FROM links ORDER BY position ASC`.

**Writes (per intent):**
- `create` → `INSERT INTO links (slug, label, url, position, enabled) VALUES (?, ?, ?, MAX(position) + 1, 1)`
- `update` → `UPDATE links SET <changed columns>, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
- `toggle` → same as `update` with only `enabled` toggling
- `delete` → `DELETE FROM links WHERE id = ?`
- `moveUp` / `moveDown` → two `UPDATE` statements swapping `position` between two adjacent rows

No new migrations.

## Tests

`app/lib/admin-links.test.ts` — 33 cases, all green against in-memory D1.

Why this many: every business rule has at least one test (auto-position, slug regex, reserved set membership including each entry, URL parseability, uniqueness on create + update, last-link on disable + delete, move semantics including edges). If a rule changes, the test that owns it should be the first thing to fail. Coverage for `app/lib/admin-links.ts` is effectively 100% by construction.

UI is **not** unit-tested per CLAUDE.md (UI shells aren't TDD'd). Verified end-to-end via dev server:
- Reserved slug `admin` rejected with 400 + readable error
- Valid create returns 200, new row visible in DB at auto-assigned position
- Disabling the last enabled link returns 422 with the spec'd error message
- Reorder swap is reflected in subsequent loader output
- Delete confirmation prompt fires before submission

## Dependencies

**Depends on:**
- [00-foundation](00-foundation.md) — schema, Drizzle, vitest pool-workers
- [01-public-page](01-public-page.md) — last-link guard exists because the public page returns 503 with zero enabled links
- [04-backoffice-auth](04-backoffice-auth.md) — admin layout that renders this page; Cloudflare Access policy in production

**Depended on by:**
- 07-backoffice-analytics shares the admin layout and form patterns from this feature.
- The admin operations write to `links` whose `slug` is the source-tracking identifier from Feature 02 — slug changes here change the source string going forward (existing events keep their old slug, since events store the captured string at the time, not a FK).

## Notes / Decisions

### `action="?index"` on every form

React Router nested-route actions need disambiguation when both a parent layout and an index child match the URL. Without `?index`, posting to `/admin` dispatches to the parent layout (no action) and 405s. Every form in this route therefore sets `action="?index"` (or `"/admin?index"` for the modal which lives outside the page in DOM order but submits to the same logical route). If we ever add a `<Route>` for `/admin/links` instead of using the index, we can drop these.

### Discriminated-union return type instead of throws

Lib functions return `{ ok: true, data } | { ok: false, error, status }` rather than throwing. Reasons:
1. Test ergonomics — `expect(result).toMatchObject({ ok: false, status: 422 })` is cleaner than `expect.rejects.toMatchObject(...)`.
2. The action handler can naturally pass `result.status` to `data()` for the HTTP response code.
3. Validation errors aren't exceptional — they're the expected outcome of the user typing bad input.

Status-code conventions inside the union:
- `400` — input shape/format problem (slug pattern, reserved slug, invalid URL, missing label, etc.)
- `404` — id not found
- `409` — slug uniqueness conflict
- `422` — business-rule violation (last-link guard) — semantically "request is well-formed but I refuse"

### Reserved slugs

`admin`, `out`, `api`, `settings` are blocked. Each collides with a literal route segment (`/admin/*`, `/out/:slug`, eventual `/api/*`, `/admin/settings`). Letting a link have any of these slugs would render it unreachable as a source-tracking path. Test covers each value via `it.each`.

### Position is integer, not unique

Two updates swap two rows' `position` values directly. There's no UNIQUE constraint on `position`, so an intermediate state where two rows briefly share a position isn't a constraint violation — and after the second update, ordering is restored. If an unlikely failure between the two updates left two rows with the same position, the next "move" click on either row would re-converge. Cheaper than wrapping in a transaction, fine for MVP.

### Modal is a simple state-driven overlay

`useState<number | null>` holds the editing link id. The modal is conditionally rendered. Clicking the backdrop or Cancel calls `onClose`. After a successful update, a `useEffect` watching `actionData` closes the modal. No portals, no native `<dialog>` — flat React state in the route component. Sufficient for one form.

### Delete confirmation via `window.confirm`

A blocking native confirm is used on the Delete form's `onSubmit`. Cancelable with `e.preventDefault()`. Acceptable for MVP — admin is the only user, and the spec doesn't ask for a fancy custom-styled confirmation. If we ever want a styled prompt, replace with another modal.

### Slug change on existing link is allowed

If the admin renames `instagram` → `ig`, the new URL `/ig` becomes the source-tracking path and `/instagram` stops resolving. Historical events keep `source = 'instagram'` because Feature 02 stored the string at capture time. Analytics for the rename period thus shows two source values for the same logical platform; the admin can mentally merge them in the dashboard.

### URL validation is `new URL(...)` only

We don't HEAD the URL, don't restrict to `https://`, don't filter domains. The admin is the only writer; if they paste a broken URL, their public buttons are broken until they fix it. Cheaper than maintaining a domain allowlist, and lets the admin point at non-HTTPS dev URLs while iterating.
