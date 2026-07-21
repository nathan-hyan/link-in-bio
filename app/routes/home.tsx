import type { Route } from "./+types/home";
import { getDb } from "../db/client";
import { logPageView } from "../lib/events";
import { getEnabledLinks } from "../lib/links";
import { shouldLogPageView } from "../lib/page-view-filter";
import { getBgImageUrl, getLatestVideo } from "../lib/settings";
import { reorderForSource } from "../lib/source-reorder";
import { resolveSource } from "../lib/source-resolution";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Hy-An | Link In Bio" },
    {
      name: "description",
      content: "Hy-An — est. 1995. Listen, watch, follow.",
    },
  ];
}

export async function loader({
  context,
  params,
  request,
}: Route.LoaderArgs) {
  const db = getDb(context.cloudflare.env.DB);
  const [links, bgImageUrl, latestVideo] = await Promise.all([
    getEnabledLinks(db),
    getBgImageUrl(db),
    getLatestVideo(db),
  ]);

  if (links.length === 0) {
    throw new Response(null, { status: 503 });
  }

  const validSlugs = new Set(links.map((l) => l.slug));
  const { source, rawPath } = resolveSource(params.slug, validSlugs);

  if (shouldLogPageView({ rawPath, userAgent: request.headers.get("user-agent") })) {
    await logPageView({ db, source, rawPath, request });
  }

  return { links: reorderForSource(links, source), source, bgImageUrl, latestVideo };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { links, source, bgImageUrl, latestVideo } = loaderData;

  return (
    <main
      className="min-h-screen w-full flex items-center justify-center bg-cover bg-center px-4 py-12"
      style={{ backgroundImage: `url('${bgImageUrl}')` }}
    >
      {/* Column on mobile (video drops to the bottom), row on desktop (video to the right). */}
      <div className="w-full max-w-md lg:max-w-4xl flex flex-col lg:flex-row items-center lg:items-start justify-center gap-6 lg:gap-8">
        <section className="w-full max-w-md bg-white/40 backdrop-blur-md rounded-2xl shadow-xl ring-1 ring-white/40 px-6 py-8 sm:px-10 sm:py-10">
          <div className="text-center mb-6">
            <img
              src="/hyan_logo.svg"
              alt="Hy-An"
              className="mx-auto mb-3 h-16 sm:h-20 w-auto"
            />
            <p className="text-gray-800">est. 1995</p>
          </div>

          <ul className="flex flex-col gap-3">
            {links.map((link) => (
              <li key={link.slug}>
                <a
                  href={`/out/${link.slug}?source=${encodeURIComponent(source)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-4 py-3 bg-white hover:bg-gray-100 active:bg-gray-200 rounded-lg text-gray-700 hover:text-gray-900 text-center font-medium shadow-sm transition-colors"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </section>

        {latestVideo && (
          <section className="w-full max-w-md bg-white/40 backdrop-blur-md rounded-2xl shadow-xl ring-1 ring-white/40 px-6 py-8 sm:px-10 sm:py-10">
            <div className="aspect-video w-full overflow-hidden rounded-lg shadow-sm">
              <iframe
                src={`https://www.youtube.com/embed/${latestVideo.id}`}
                title={latestVideo.title || "Latest Hy-An video"}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="h-full w-full"
              />
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
