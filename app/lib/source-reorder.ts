import { DIRECT } from "./source-resolution";

export function reorderForSource<T extends { slug: string }>(
  links: T[],
  source: string
): T[] {
  if (source === DIRECT) return [...links];
  const idx = links.findIndex((l) => l.slug === source);
  if (idx === -1) return [...links];
  if (idx === links.length - 1) return [...links];
  return [...links.slice(0, idx), ...links.slice(idx + 1), links[idx]];
}
