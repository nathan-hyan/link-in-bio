import type { Route } from "./+types/admin._index";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Links — Hy-An Admin" }];
}

export default function AdminLinks() {
  return (
    <section>
      <h1 className="text-2xl font-semibold text-gray-900 mb-2">Links</h1>
      <p className="text-gray-600">
        Link CRUD UI ships in Feature 05. This page is a placeholder so
        Cloudflare Access can be configured for the whole <code>/admin</code> path.
      </p>
    </section>
  );
}
