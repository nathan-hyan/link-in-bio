import { type RouteConfig, route } from "@react-router/dev/routes";

export default [
  route("out/:slug", "routes/out-redirect.tsx"),
  route(":slug?", "routes/home.tsx"),
] satisfies RouteConfig;
