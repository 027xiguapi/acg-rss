import { SITE_URL, absoluteUrl } from "@/lib/site";
import { listSeriesFullForLlm } from "@/server/seo";

// ISR: the catalog changes as feeds are fetched, so refresh hourly.
export const revalidate = 3600;

/** Human-readable labels for the catalog facets (the document is English). */
const TYPE_LABELS: Record<string, string> = {
  TV: "TV series",
  MOVIE: "Movie",
  OVA: "OVA",
  ONA: "ONA",
  SPECIAL: "Special",
  OTHER: "Other",
};

const ORIGIN_LABELS: Record<string, string> = {
  JP: "Japan",
  CN: "Mainland China",
  HK: "Hong Kong",
  TW: "Taiwan",
  KR: "South Korea",
  WEST: "Western",
  OTHER: "Other",
};

const WEEKDAY_LABELS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

/** Fact line for a series: "TV series · Japan · 2023 · Season 1 · airs Monday". */
function factLine(series: {
  type: string | null;
  origin: string | null;
  year: number | null;
  season: number;
  airDay: number | null;
}): string {
  const parts = [
    series.type ? TYPE_LABELS[series.type] ?? series.type : null,
    series.origin ? ORIGIN_LABELS[series.origin] ?? series.origin : null,
    series.year != null ? String(series.year) : null,
    `Season ${series.season}`,
    series.airDay != null && series.airDay >= 1 && series.airDay <= 7
      ? `airs ${WEEKDAY_LABELS[series.airDay - 1] ?? ""}`.trim()
      : null,
  ].filter((part): part is string => part != null && part.length > 0);
  return parts.join(" · ");
}

/**
 * /llms-full.txt — the llmstxt.org "full content" companion to /llms.txt: the
 * whole catalog inlined (synopses, alternate names and per-episode listings)
 * so a model can read the site in one fetch without following every link.
 */
export async function GET(): Promise<Response> {
  let series: Awaited<ReturnType<typeof listSeriesFullForLlm>> = [];
  try {
    series = await listSeriesFullForLlm();
  } catch (error) {
    console.error("[llms-full.txt] catalog unavailable:", error);
  }

  const episodeCount = series.reduce((total, item) => total + item.episodes.length, 0);

  const lines: string[] = [
    "# wami-acg — full content",
    "",
    "> wami-acg is a self-hosted anime (bangumi) release tracker. It aggregates torrent RSS feeds, parses each release title for series / season / episode / resolution / subgroup, and files every torrent under the matching series and episode.",
    "",
    `This is the full-text companion to ${absoluteUrl("/llms.txt")}, inlining the whole catalog (${series.length} series, ${episodeCount} episodes). Pages are available in English, Simplified Chinese, Japanese and Korean; English URLs are unprefixed, other languages are prefixed with the locale code (\`/zh-CN\`, \`/ja\`, \`/ko\`).`,
    "",
  ];

  if (series.length === 0) {
    lines.push(
      "The catalog is currently unavailable.",
      "",
      `See ${absoluteUrl("/llms.txt")} for the list of core pages.`
    );
  } else {
    lines.push("## Series", "");
    for (const item of series) {
      lines.push(`### ${item.title}`, "", `- URL: ${absoluteUrl(`/bangumi/${item.id}`)}`);
      const facts = factLine(item);
      if (facts) lines.push(`- Facts: ${facts}`);
      if (item.synonyms.length > 0) {
        lines.push(`- Also known as: ${item.synonyms.join(", ")}`);
      }
      if (item.content) {
        lines.push("", item.content);
      }
      if (item.episodes.length > 0) {
        lines.push("", "Episodes:");
        for (const episode of item.episodes) {
          const label = episode.title
            ? `Episode ${episode.number}: ${episode.title}`
            : `Episode ${episode.number}`;
          lines.push(`- [${label}](${absoluteUrl(`/episode/${episode.id}`)})`);
          if (episode.content) lines.push(`  ${episode.content}`);
        }
      }
      lines.push("");
    }
  }

  lines.push("---", "", `Site: ${SITE_URL}`);

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600",
    },
  });
}
