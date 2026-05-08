import { useEffect, useState } from "react";
import { NavLink } from "react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Route } from "./+types/admin.analytics";
import { getDb } from "../db/client";
import {
  fillDailyGaps,
  getCountryCounts,
  getDailySeries,
  getDestinationCounts,
  getSourceCounts,
  getSourceDestinationMatrix,
  getTotals,
  parseDateRange,
  rangeToStartDate,
} from "../lib/analytics";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Analytics — Hy-An Admin" }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const range = parseDateRange(url.searchParams.get("range"));
  const start = rangeToStartDate(range);
  const today = new Date().toISOString().slice(0, 10);

  const db = getDb(context.cloudflare.env.DB);
  const [totals, daily, sources, destinations, matrix, countries] =
    await Promise.all([
      getTotals(db, start),
      getDailySeries(db, start),
      getSourceCounts(db, start),
      getDestinationCounts(db, start),
      getSourceDestinationMatrix(db, start),
      getCountryCounts(db, start, 10),
    ]);

  // Fill the time-series gaps so the line chart shows a continuous x-axis.
  // For "all", anchor the start at the earliest event we have.
  const seriesStart = start ?? daily[0]?.day ?? today;
  const series = fillDailyGaps(daily, seriesStart, today);

  const ctr =
    totals.pageViews > 0
      ? Math.round((totals.linkClicks / totals.pageViews) * 1000) / 10
      : 0;

  return {
    range,
    totals,
    ctr,
    series,
    sources,
    destinations,
    matrix,
    countries,
  };
}

export default function AdminAnalytics({
  loaderData,
}: Route.ComponentProps) {
  const { range, totals, ctr, series, sources, destinations, matrix, countries } =
    loaderData;

  // Pull unique destination slugs from the matrix to build the cross-tab columns
  const destinationsForMatrix = Array.from(
    new Set(matrix.map((m) => m.slug))
  ).sort();
  const sourcesForMatrix = Array.from(new Set(matrix.map((m) => m.source))).sort();
  const matrixCell = (source: string, slug: string): number => {
    const row = matrix.find((m) => m.source === source && m.slug === slug);
    return row?.count ?? 0;
  };

  return (
    <section className="space-y-6">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold text-gray-900">Analytics</h1>
        <DateRangeSelector current={range} />
      </div>

      <Headline
        pageViews={totals.pageViews}
        linkClicks={totals.linkClicks}
        ctr={ctr}
      />

      <Card title="Traffic over time">
        {series.length === 0 ? (
          <Empty />
        ) : (
          <div style={{ width: "100%", height: 280 }}>
            <ClientOnly>
              <ResponsiveContainer>
                <LineChart
                  data={series}
                  margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                    tickFormatter={(d: string) => d.slice(5)}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                    allowDecimals={false}
                  />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="pageViews"
                    name="Page views"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="linkClicks"
                    name="Link clicks"
                    stroke="#16a34a"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ClientOnly>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Sources (page views)">
          {sources.length === 0 ? (
            <Empty />
          ) : (
            <div style={{ width: "100%", height: 32 + sources.length * 28 }}>
              <ClientOnly>
                <ResponsiveContainer>
                  <BarChart
                    layout="vertical"
                    data={sources}
                    margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11, fill: "#6b7280" }}
                      allowDecimals={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="source"
                      tick={{ fontSize: 11, fill: "#6b7280" }}
                      width={90}
                    />
                    <Tooltip />
                    <Bar dataKey="count" fill="#2563eb" />
                  </BarChart>
                </ResponsiveContainer>
              </ClientOnly>
            </div>
          )}
        </Card>

        <Card title="Destinations (link clicks)">
          {destinations.length === 0 ? (
            <Empty />
          ) : (
            <div
              style={{ width: "100%", height: 32 + destinations.length * 28 }}
            >
              <ClientOnly>
                <ResponsiveContainer>
                  <BarChart
                    layout="vertical"
                    data={destinations}
                    margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11, fill: "#6b7280" }}
                      allowDecimals={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="slug"
                      tick={{ fontSize: 11, fill: "#6b7280" }}
                      width={90}
                    />
                    <Tooltip />
                    <Bar dataKey="count" fill="#16a34a" />
                  </BarChart>
                </ResponsiveContainer>
              </ClientOnly>
            </div>
          )}
        </Card>
      </div>

      <Card title="Source × destination (click counts)">
        {matrix.length === 0 ? (
          <Empty />
        ) : (
          <div className="overflow-x-auto">
            <table className="text-sm w-full">
              <thead>
                <tr className="bg-gray-50 text-gray-700">
                  <th className="px-3 py-2 text-left font-medium">Source ↓ / Destination →</th>
                  {destinationsForMatrix.map((slug) => (
                    <th
                      key={slug}
                      className="px-3 py-2 text-right font-mono text-xs font-medium"
                    >
                      {slug}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sourcesForMatrix.map((source) => (
                  <tr key={source}>
                    <td className="px-3 py-2 font-medium">{source}</td>
                    {destinationsForMatrix.map((slug) => {
                      const v = matrixCell(source, slug);
                      return (
                        <td
                          key={slug}
                          className={`px-3 py-2 text-right font-mono text-xs ${v === 0 ? "text-gray-300" : "text-gray-900"}`}
                        >
                          {v}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Top countries (page views)">
        {countries.length === 0 ? (
          <Empty />
        ) : (
          <table className="text-sm w-full">
            <thead>
              <tr className="bg-gray-50 text-gray-700">
                <th className="px-3 py-2 text-left font-medium">Country</th>
                <th className="px-3 py-2 text-right font-medium w-24">Views</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {countries.map((c) => (
                <tr key={c.country}>
                  <td className="px-3 py-2 font-mono text-xs">{c.country}</td>
                  <td className="px-3 py-2 text-right">{c.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </section>
  );
}

const RANGES: Array<{ value: "7d" | "30d" | "90d" | "all"; label: string }> = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "all", label: "All time" },
];

function DateRangeSelector({
  current,
}: {
  current: "7d" | "30d" | "90d" | "all";
}) {
  return (
    <nav className="flex gap-1 text-sm" aria-label="Date range">
      {RANGES.map((r) => (
        <NavLink
          key={r.value}
          to={`?range=${r.value}`}
          className={() =>
            `px-3 py-1 rounded-md ${
              current === r.value
                ? "bg-gray-900 text-white"
                : "text-gray-700 hover:bg-gray-100 border border-gray-300"
            }`
          }
        >
          {r.label}
        </NavLink>
      ))}
    </nav>
  );
}

function Headline({
  pageViews,
  linkClicks,
  ctr,
}: {
  pageViews: number;
  linkClicks: number;
  ctr: number;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <Stat label="Page views" value={pageViews.toLocaleString()} />
      <Stat label="Link clicks" value={linkClicks.toLocaleString()} />
      <Stat
        label="CTR"
        value={pageViews === 0 ? "—" : `${ctr.toFixed(1)}%`}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="text-xs uppercase tracking-wider text-gray-500">
        {label}
      </div>
      <div className="text-2xl font-semibold text-gray-900 mt-1 tabular-nums">
        {value}
      </div>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h2 className="text-sm font-medium text-gray-900 mb-3">{title}</h2>
      {children}
    </div>
  );
}

function Empty() {
  return (
    <p className="text-sm text-gray-500 italic py-6 text-center">
      No data in the selected range yet.
    </p>
  );
}

/**
 * Renders children only after client-side hydration. Used to skip Recharts
 * during SSR — `<ResponsiveContainer>` can't measure its parent on the
 * server and would log "width(-1) and height(-1)" warnings each request.
 * The chart appears immediately after hydration, which is invisible to
 * the user in practice. Tables remain SSR-rendered so the page is useful
 * even before JS loads.
 */
function ClientOnly({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return <>{children}</>;
}
