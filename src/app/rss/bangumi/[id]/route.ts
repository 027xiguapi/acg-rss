import { NextResponse } from "next/server";
import { loadBangumi } from "@/server/bangumi/detail";
import {
  loadBangumiTorrents,
  renderRss,
  siteBaseUrl,
  toRssItems,
} from "@/server/rss/feed";

export const dynamic = "force-dynamic";

/**
 * Per-project RSS feed (Mikan-style): one <item> per torrent release of the
 * tracked series, with the .torrent link in <enclosure>. Subscribe a reader
 * to /rss/bangumi/{id} to receive new releases of that project.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const bangumiId = Number(id);
  if (!Number.isInteger(bangumiId) || bangumiId <= 0) {
    return new NextResponse("Not found", { status: 404 });
  }

  const item = await loadBangumi(bangumiId);
  if (!item) return new NextResponse("Not found", { status: 404 });

  const base = siteBaseUrl(request);
  const torrents = await loadBangumiTorrents(bangumiId);

  const title = `acg-rss - ${item.title}`;
  const xml = renderRss(
    {
      title,
      description: title,
      link: `${base}/rss/bangumi/${bangumiId}`,
    },
    toRssItems(base, torrents)
  );

  return new NextResponse(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
