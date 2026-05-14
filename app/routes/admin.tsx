import { Link, NavLink, Outlet } from "react-router";
import type { Route } from "./+types/admin";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Admin — Hy-An Link in Bio" }];
}

/**
 * Hard gate for /admin/**. Cloudflare Access (configured in the dashboard)
 * is supposed to challenge every request to /admin* at the edge and only
 * forward authenticated ones to this Worker. When that policy is missing
 * or misconfigured, the edge passes raw requests straight to us — exactly
 * the situation that left /admin open in the wild. This loader is the
 * defense in depth: in production, refuse any request that did not come
 * through CF Access (which sets the `Cf-Access-Jwt-Assertion` header on
 * every authenticated request). Local dev (`wrangler dev` on localhost)
 * skips the check.
 *
 * NOTE: the dashboard-level CF Access policy is still the primary gate —
 * it shows a real login UI. This 401 is the safety net.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const isLocalDev =
    url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (isLocalDev) return null;

  const jwt = request.headers.get("cf-access-jwt-assertion");
  if (!jwt) {
    throw new Response(
      "Cloudflare Access is not active on /admin*. Configure a self-hosted Access policy in the Cloudflare Zero Trust dashboard before this page can load. See docs/04-backoffice-auth.md.",
      { status: 401, headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );
  }
  return null;
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  isActive
    ? "text-gray-900 font-medium"
    : "text-gray-500 hover:text-gray-900 transition-colors";

export default function AdminLayout() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Link to="/admin" className="font-semibold text-gray-900">
            Hy-An Admin
          </Link>
          <nav className="flex gap-4 text-sm items-center">
            <NavLink to="/admin" end className={navLinkClass}>
              Links
            </NavLink>
            <NavLink to="/admin/analytics" className={navLinkClass}>
              Analytics
            </NavLink>
            <NavLink to="/admin/settings" className={navLinkClass}>
              Settings
            </NavLink>
            <a
              href="/"
              className="text-gray-500 hover:text-gray-900 transition-colors"
            >
              View site →
            </a>
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
