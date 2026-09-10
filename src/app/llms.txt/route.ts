import { SITE_URL, absoluteUrl } from "@/lib/site";
import { listEpisodesForLlm, listSeriesForLlm } from "@/server/seo";

// ISR: the catalog changes as feeds are fetched, so refresh hourly.
export const revalidate = 3600;

/** Human-readable label for a bangumi work type. */
const TYPE_LABELS: Record<string, string> = {
  TV: "TV series",
  MOVIE: "Movie",
  OVA: "OVA",
  ONA: "ONA",
  SPECIAL: "Special",
  OTHER: "Other",
};

/** "TV series · 2023 · Season 1" — the parts a release actually has. */
function seriesMeta(series: {
  type: string | null;
  year: number | null;
  season: number;
}): string {
  const parts = [
    series.type ? TYPE_LABELS[series.type] ?? series.type : null,
    series.year != null ? String(series.year) : null,
    `Season ${series.season}`,
  ].filter((part): part is string => part != null);
  return parts.join(" · ");
}

/**
 * /llms.txt — the llmstxt.org convention: a concise, link-rich markdown
 * overview so LLMs can discover the catalog without crawling the whole site.
 * Catalog links point at the default (English, unprefixed) URLs.
 */
export async function GET(): Promise<Response> {
  const lines: string[] = [
    "# wami-acg",
    "",
    "> wami-acg is a self-hosted anime (bangumi) release tracker. It aggregates torrent RSS feeds, parses each release title for series / season / episode / resolution / subgroup, and files every torrent under the matching series and episode.",
  ];

  // Catalog rows power the counts, the series index and the episode index.
  // Degrade to the core-pages document when the database is unavailable.
  let series: Awaited<ReturnType<typeof listSeriesForLlm>> = [];
  let episodes: Awaited<ReturnType<typeof listEpisodesForLlm>> = [];
  try {
    [series, episodes] = await Promise.all([
      listSeriesForLlm(),
      listEpisodesForLlm(),
    ]);
  } catch (error) {
    console.error("[llms.txt] catalog unavailable:", error);
  }

  if (series.length > 0 || episodes.length > 0) {
    lines.push(
      "",
      `The catalog currently covers ${series.length} series and ${episodes.length} episodes.`
    );
  }

  lines.push(
    "",
    "Pages are available in English, Simplified Chinese, Japanese and Korean. English URLs are unprefixed; other languages are prefixed with the locale code (for example `/zh-CN`, `/ja`, `/ko`).",
    "",
    "## Core pages",
    "",
    `- [Home](${absoluteUrl("/")}): weekly airing schedule, recent updates, and search across series titles and aliases.`,
    `- [Torrents](${absoluteUrl("/torrents")}): every indexed release, searchable and paginated.`,
    `- [Contact](${absoluteUrl("/contact")}): how to reach the maintainers.`,
    `- [Privacy](${absoluteUrl("/privacy")}): data-handling policy.`
  );

  if (series.length > 0) {
    lines.push("", "## Series", "");
    for (const item of series) {
      lines.push(
        `- [${item.title}](${absoluteUrl(`/bangumi/${item.id}`)}): ${seriesMeta(item)}`
      );
    }
  }

  if (episodes.length > 0) {
    lines.push("", "## Episodes", "");
    for (const episode of episodes) {
      lines.push(
        `- [${episode.seriesTitle} — Episode ${episode.number}](${absoluteUrl(`/episode/${episode.id}`)})`
      );
    }
  }

  lines.push(
    "",
    "## Optional",
    "",
    `- [Sitemap](${absoluteUrl("/sitemap.xml")}): machine-readable index of every page, with hreflang alternates per language.`,
    `- [RSS feed](${absoluteUrl("/rss")}): the newest aggregated releases across all tracked series.`,
    `- [Full content](${absoluteUrl("/llms-full.txt")}): the whole catalog inlined in one document, including series synopses and per-episode listings.`,
    "",
    `Site: ${SITE_URL}`
  );

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600",
    },
  });
}
