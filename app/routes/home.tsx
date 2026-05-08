import type { Route } from "./+types/home";
import { getDb } from "../db/client";
import { logPageView } from "../lib/events";
import { getEnabledLinks } from "../lib/links";
import { getBgImageUrl } from "../lib/settings";
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
  const [links, bgImageUrl] = await Promise.all([
    getEnabledLinks(db),
    getBgImageUrl(db),
  ]);

  if (links.length === 0) {
    throw new Response(null, { status: 503 });
  }

  const validSlugs = new Set(links.map((l) => l.slug));
  const { source, rawPath } = resolveSource(params.slug, validSlugs);

  await logPageView({ db, source, rawPath, request });

  return { links: reorderForSource(links, source), source, bgImageUrl };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { links, source, bgImageUrl } = loaderData;

  return (
    <main
      className="min-h-screen w-full flex items-center justify-center bg-cover bg-center px-4 py-12"
      style={{ backgroundImage: `url('${bgImageUrl}')` }}
    >
      <section className="w-full max-w-md sm:max-w-2xl bg-white/40 backdrop-blur-md rounded-2xl shadow-xl ring-1 ring-white/40 px-6 py-8 sm:px-10 sm:py-12">
        <div className="text-center mb-8">
          <img
            src="/hyan_logo.svg"
            alt="Hy-An"
            className="mx-auto mb-4 w-40 h-40 sm:w-56 sm:h-56"
          />
          <p className="text-gray-800">est. 1995</p>
        </div>

        <ul className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-4 justify-center">
          {links.map((link) => (
            <li key={link.slug} className="sm:flex-shrink-0">
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
    </main>
  );
}
