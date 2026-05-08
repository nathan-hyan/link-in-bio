import { Link, NavLink, Outlet } from "react-router";
import type { Route } from "./+types/admin";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Admin — Hy-An Link in Bio" }];
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
