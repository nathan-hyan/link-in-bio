import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  route("out/:slug", "routes/out-redirect.tsx"),
  route("admin", "routes/admin.tsx", [
    index("routes/admin._index.tsx"),
    route("analytics", "routes/admin.analytics.tsx"),
  ]),
  route(":slug?", "routes/home.tsx"),
] satisfies RouteConfig;
