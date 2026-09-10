import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { getPathname } from "@/i18n/navigation";
import { absoluteUrl } from "@/lib/site";
import { listBangumiPaths, listEpisodePaths } from "@/server/seo";

// ISR: refresh hourly so newly linked releases surface without a rebuild.
export const revalidate = 3600;

type ChangeFrequency = MetadataRoute.Sitemap[number]["changeFrequency"];

/** Locale-agnostic routes every visitor should be able to discover. */
const STATIC_ROUTES: {
  path: string;
  priority: number;
  changeFrequency: ChangeFrequency;
}[] = [
  { path: "", priority: 1, changeFrequency: "daily" },
  { path: "/torrents", priority: 0.8, changeFrequency: "daily" },
  { path: "/contact", priority: 0.3, changeFrequency: "yearly" },
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
];

/** URL of one locale-agnostic path in a given locale. */
function localeUrl(path: string, locale: string): string {
  // getPathname applies the configured locale prefix, so the default locale
  // is emitted unprefixed ("/") while others keep their prefix ("/zh-CN").
  return absoluteUrl(getPathname({ href: path || "/", locale }));
}

/**
 * One sitemap entry per logical path: the default-locale URL plus an
 * `alternates.languages` map covering every locale, so crawlers index the
 * localized versions instead of treating them as duplicate content.
 */
function entry(
  path: string,
  priority: number,
  changeFrequency: ChangeFrequency,
  lastModified?: Date
): MetadataRoute.Sitemap[number] {
  const languages: Record<string, string> = {};
  for (const locale of routing.locales) {
    languages[locale] = localeUrl(path, locale);
  }
  const defaultLocale: string = routing.defaultLocale;
  languages["x-default"] = localeUrl(path, defaultLocale);

  const result: MetadataRoute.Sitemap[number] = {
    url: localeUrl(path, defaultLocale),
    changeFrequency,
    priority,
    alternates: { languages },
  };
  if (lastModified) result.lastModified = lastModified;
  return result;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries = STATIC_ROUTES.map((route) =>
    entry(route.path, route.priority, route.changeFrequency)
  );

  // Dynamic detail pages. Degrade gracefully when the database is
  // unreachable (e.g. a build without one) instead of failing the sitemap.
  try {
    const [bangumiPaths, episodePaths] = await Promise.all([
      listBangumiPaths(),
      listEpisodePaths(),
    ]);
    for (const item of bangumiPaths) {
      entries.push(entry(`/bangumi/${item.id}`, 0.7, "weekly", item.lastModified));
    }
    for (const item of episodePaths) {
      entries.push(entry(`/episode/${item.id}`, 0.6, "weekly", item.lastModified));
    }
  } catch (error) {
    console.error("[sitemap] skipping dynamic routes:", error);
  }

  return entries;
}
