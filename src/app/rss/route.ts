import { NextResponse } from "next/server";
import {
  loadAllTorrents,
  renderRss,
  siteBaseUrl,
  toRssItems,
} from "@/server/rss/feed";

export const dynamic = "force-dynamic";

/**
 * Aggregate RSS feed: the newest project-linked releases across every
 * tracked series. Subscribe to /rss for all updates, or to /rss/bangumi/{id}
 * for a single project.
 */
export async function GET(request: Request) {
  const base = siteBaseUrl(request);
  const torrents = await loadAllTorrents();

  const xml = renderRss(
    {
      title: "acg-rss",
      description: "acg-rss — latest releases across all tracked series",
      link: `${base}/rss`,
    },
    toRssItems(base, torrents)
  );

  return new NextResponse(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
