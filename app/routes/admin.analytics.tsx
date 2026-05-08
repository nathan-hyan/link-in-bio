import type { Route } from "./+types/admin.analytics";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Analytics — Hy-An Admin" }];
}

export default function AdminAnalytics() {
  return (
    <section>
      <h1 className="text-2xl font-semibold text-gray-900 mb-2">Analytics</h1>
      <p className="text-gray-600">
        Analytics dashboard ships in Feature 06.
      </p>
    </section>
  );
}
