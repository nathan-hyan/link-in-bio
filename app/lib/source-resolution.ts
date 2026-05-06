export interface ResolvedSource {
  source: string;
  rawPath: string;
}

export const DIRECT = "direct";

export function resolveSource(
  rawSlug: string | undefined,
  validSlugs: ReadonlySet<string>
): ResolvedSource {
  if (!rawSlug) {
    return { source: DIRECT, rawPath: "" };
  }
  if (validSlugs.has(rawSlug)) {
    return { source: rawSlug, rawPath: "" };
  }
  return { source: DIRECT, rawPath: rawSlug };
}
