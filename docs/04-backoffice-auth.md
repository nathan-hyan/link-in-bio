# 04 — Backoffice auth

## Purpose

Gate the entire `/admin/**` URL space behind authentication so only the admin (you) can reach the link CRUD and analytics dashboards. Auth is **not implemented in app code** — it's a Cloudflare Access (Zero Trust) policy at the edge. Visitors hitting `/admin/*` get a CF-hosted login challenge before the request reaches the Worker.

This feature ships the **route shells**: a parent `/admin` layout and two placeholder children (Links, Analytics). Features 05 and 06 fill them in.

## Files

### App code
- `app/routes/admin.tsx` — **new**. Parent layout with header (title + nav: Links / Analytics / "View site →"), shared light-gray bg, max-width container. Renders `<Outlet />` for the active child.
- `app/routes/admin._index.tsx` — **new**. Placeholder for the Links page (Feature 05 fills it).
- `app/routes/admin.analytics.tsx` — **new**. Placeholder for the Analytics dashboard (Feature 06 fills it).
- `app/routes.ts` — **modified**. Adds the nested admin route block:
  ```ts
  route("admin", "routes/admin.tsx", [
    index("routes/admin._index.tsx"),
    route("analytics", "routes/admin.analytics.tsx"),
  ]),
  ```
  Listed before the `:slug?` catch route. Even without ordering, RR matches literal segments over params, so `/admin` and `/admin/analytics` resolve to the admin block (not the source-tracking catch-all).

### Docs
- `docs/04-backoffice-auth.md` — this file.

## Routes / Endpoints

| Path | Handler | Behavior |
|---|---|---|
| `/admin` | `routes/admin.tsx` → `routes/admin._index.tsx` | Layout + Links placeholder. CF Access challenge in production. |
| `/admin/analytics` | `routes/admin.tsx` → `routes/admin.analytics.tsx` | Layout + Analytics placeholder. CF Access challenge in production. |
| `/admin/*` (anything else under admin/) | none | 404 from React Router. CF Access still challenges first; auth'd users land on a 404. |

## Database

No DB reads, no DB writes, no migrations.

## Tests

None automated. Per CLAUDE.md, UI shells aren't TDD'd. Verified manually:
- `/admin` → 200, renders "Links" placeholder
- `/admin/analytics` → 200, renders "Analytics" placeholder
- `/admin/nonexistent` → 404 (RR's "No route matches")
- `/` and `/:slug` still work; **/admin is NOT logged as a page_view** (the literal admin route wins over `:slug?`, so the source-tracking loader never runs for it). Confirmed by querying the events table after hitting `/admin` — no row appears.

## Dependencies

**Depends on:**
- [00-foundation](00-foundation.md) — RR routing config, Tailwind, the Workers entry

**Depended on by:**
- 05-backoffice-links — fills `routes/admin._index.tsx` with the link CRUD UI and action handlers
- 06-backoffice-analytics — fills `routes/admin.analytics.tsx` with the dashboard

## Notes / Decisions

### Why CF Access vs app-level auth

For a single-tenant single-admin site, CF Access is dramatically simpler than rolling our own auth:
- Zero auth code in the app — the gate runs at the CF edge before any Worker code executes.
- Free for up to 50 users on any Cloudflare account (Zero Trust SKU, separate from Workers/D1 but on the same account).
- Login via email OTP or any major OAuth provider, picked in the CF dashboard.
- Tests don't have to mock authentication.

The cost: this couples auth to Cloudflare. If we ever leave CF, we'd need to add auth then. Acceptable for a personal MVP.

### Why a parent layout route

Nesting `_index` and `analytics` under `routes/admin.tsx` lets us share the header + nav across all admin pages without each child re-rendering it. Adding more admin pages later (e.g. settings) is one new file + one route entry.

### Local dev: CF Access does NOT gate localhost

`pnpm dev` runs Wrangler locally with no Cloudflare edge in front of it. So `/admin` is reachable without auth in dev. That's expected and intentional — you don't want an OTP challenge every time you start the dev server. **Auth only happens in production**, against the deployed `link-in-bio.hyan.dev`.

### Authed user identity is available but unused

If we ever need the app to know who's logged in, Cloudflare adds a `Cf-Access-Jwt-Assertion` header to authenticated requests. Loaders can read `request.headers.get("cf-access-jwt-assertion")` and decode the JWT for email/identity. Not needed for a single-admin site — skipped for MVP.

### Slug collision with `admin`

The literal `admin` route always wins over the `:slug?` catch, so even if the user creates a link with slug `admin` in the backoffice (Feature 05), `/admin` would still go to the admin UI — the link would be unreachable as a source-tracking path. **Feature 05 must reject `admin`, `out`, `api` (and anything else we add as a literal route) as link slugs**, both via UI validation and in the action handler. Documented as a TODO for Feature 05.

---

## Cloudflare Access setup (manual, one-time, do this in the CF dashboard)

> Do this once, in production, before letting anyone besides yourself reach the deployed site. Until you do, anyone who knows the URL can hit `/admin` directly.

1. **Open Cloudflare Zero Trust.** From the main Cloudflare dashboard, click your account → "Zero Trust" in the left sidebar (or go to https://one.dash.cloudflare.com/). If this is the first time, you'll be asked to pick a team name and choose the Free plan (no credit card needed for ≤50 users).

2. **Add an Application.**
   - Zero Trust → **Access** → **Applications** → **Add an application** → **Self-hosted**.
   - Application name: `Hy-An Admin` (or anything readable).
   - Session duration: 24 hours is fine.
   - Application domain: `link-in-bio.hyan.dev` with path `/admin*` (the `*` covers `/admin`, `/admin/analytics`, and any future subpaths).
   - Identity providers: at minimum, enable **One-time PIN** (email OTP). Optionally also enable Google or GitHub as an OAuth provider.

3. **Add a policy.**
   - Action: **Allow**.
   - Include rule: **Emails** = your specific email (e.g. `you@hyan.dev`).
   - This is what limits access to just you. Anyone else who hits `/admin` will fail the policy and stay on the CF login screen.

4. **Save.** The policy applies immediately. Visit `https://link-in-bio.hyan.dev/admin` — you should see Cloudflare's login screen (email entry → OTP). After OTP verification, the placeholder admin UI loads.

5. **Public path is unaffected.** `/`, `/:slug`, `/out/:slug` are not under `/admin*` and do not pass through the Access challenge. Verify by hitting the public page in an incognito window.

If you ever need to revoke access (e.g. session compromise), the same screen lets you invalidate sessions or remove the policy. Any future admin routes that live under `/admin/*` are automatically gated by the existing policy — no per-route configuration needed.
