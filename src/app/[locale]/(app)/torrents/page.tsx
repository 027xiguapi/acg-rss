import type { Metadata } from "next";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { getLocale, getTranslations } from "next-intl/server";
import { ChevronLeft, ChevronRight, Magnet } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { db } from "@/db";
import { rssFeeds, torrentItems } from "@/db/schema";
import { getSessionUser } from "@/server/auth/session";
import { formatBytes, formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { TorrentFilters } from "@/components/torrents/torrent-filters";
import { TorrentRowActions } from "@/components/torrents/torrent-row-actions";

export const metadata: Metadata = { title: "Torrents" };

const PAGE_SIZE = 25;

export default async function TorrentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getSessionUser();
  if (!user) return null;

  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const feedParam = typeof sp.feed === "string" ? Number(sp.feed) : NaN;
  const feedId =
    Number.isInteger(feedParam) && feedParam > 0 ? feedParam : 0;
  const res = typeof sp.res === "string" ? sp.res : "";
  const pageParam = typeof sp.page === "string" ? Number(sp.page) : 1;
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;

  const locale = await getLocale();
  const t = await getTranslations("torrents");
  const tCommon = await getTranslations("common");

  const conditions = [eq(rssFeeds.userId, user.id)];
  if (q) {
    const like = `%${q}%`;
    const textMatch = or(
      ilike(torrentItems.title, like),
      ilike(torrentItems.category, like),
      ilike(torrentItems.infoHash, like)
    );
    if (textMatch) conditions.push(textMatch);
  }
  if (feedId > 0) conditions.push(eq(torrentItems.feedId, feedId));
  if (res) conditions.push(eq(torrentItems.resolution, res));
  const where = and(...conditions);

  const [items, [totalRow], feeds] = await Promise.all([
    db
      .select({
        id: torrentItems.id,
        title: torrentItems.title,
        size: torrentItems.size,
        category: torrentItems.category,
        resolution: torrentItems.resolution,
        season: torrentItems.season,
        episode: torrentItems.episode,
        publishTime: torrentItems.publishTime,
        createdAt: torrentItems.createdAt,
        magnet: torrentItems.magnet,
        feedName: rssFeeds.name,
      })
      .from(torrentItems)
      .innerJoin(rssFeeds, eq(torrentItems.feedId, rssFeeds.id))
      .where(where)
      .orderBy(desc(torrentItems.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(torrentItems)
      .innerJoin(rssFeeds, eq(torrentItems.feedId, rssFeeds.id))
      .where(where),
    db
      .select({ id: rssFeeds.id, name: rssFeeds.name })
      .from(rssFeeds)
      .where(eq(rssFeeds.userId, user.id))
      .orderBy(rssFeeds.name),
  ]);

  const total = totalRow.count;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function pageHref(target: number): string {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (feedId > 0) params.set("feed", String(feedId));
    if (res) params.set("res", res);
    if (target > 1) params.set("page", String(target));
    const query = params.toString();
    return query ? `/torrents?${query}` : "/torrents";
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
        <TorrentFilters
          feeds={feeds}
          initial={{
            q,
            feed: feedId > 0 ? String(feedId) : "",
            res,
          }}
        />
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<Magnet className="size-5" />}
          title={t("empty")}
          description={t("showing", { count: 0, total })}
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {t("showing", { count: items.length, total })}
          </p>
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tCommon("title")}</TableHead>
                  <TableHead className="w-28">{t("resolution")}</TableHead>
                  <TableHead className="w-24">{tCommon("size")}</TableHead>
                  <TableHead className="w-40">{tCommon("published")}</TableHead>
                  <TableHead className="w-24 text-right">
                    {tCommon("actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <p className="max-w-[28rem] truncate font-medium">
                        {item.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.feedName}
                        {item.category ? ` · ${item.category}` : ""}
                        {item.episode != null ? ` · EP${item.episode}` : ""}
                      </p>
                    </TableCell>
                    <TableCell>
                      {item.resolution ? (
                        <Badge variant="outline">{item.resolution}</Badge>
                      ) : (
                        <span className="text-muted-foreground">–</span>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatBytes(item.size)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(item.publishTime ?? item.createdAt, locale)}
                    </TableCell>
                    <TableCell>
                      <TorrentRowActions
                        torrentId={item.id}
                        magnet={item.magnet}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground tabular-nums">
                {page} / {totalPages}
              </p>
              <div className="flex gap-2">
                {page > 1 ? (
                  <Link
                    href={pageHref(page - 1)}
                    className="inline-flex h-8 items-center gap-1 rounded-md border border-input bg-background px-3 text-xs font-medium shadow-sm transition-colors hover:bg-accent"
                  >
                    <ChevronLeft className="size-4" />
                    {tCommon("back")}
                  </Link>
                ) : null}
                {page < totalPages ? (
                  <Link
                    href={pageHref(page + 1)}
                    className="inline-flex h-8 items-center gap-1 rounded-md border border-input bg-background px-3 text-xs font-medium shadow-sm transition-colors hover:bg-accent"
                  >
                    {tCommon("all")}
                    <ChevronRight className="size-4" />
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
