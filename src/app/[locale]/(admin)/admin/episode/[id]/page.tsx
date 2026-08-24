import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Tv } from "lucide-react";
import { db } from "@/db";
import { torrentItems } from "@/db/schema";
import { loadEpisode } from "@/server/anime/episode";
import { extractSubgroup } from "@/lib/parser";
import { formatBytes, formatDateTime } from "@/lib/format";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { Breadcrumb } from "@/components/breadcrumb";
import { TorrentRowActions } from "@/components/torrents/torrent-row-actions";
import { EpisodeCoverForm } from "@/components/anime/episode-cover-form";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const row = await loadEpisode(Number(id));
  return { title: row ? `${row.series.title} · #${row.episode.number}` : "Episode" };
}

/**
 * Admin-only episode management: edit the episode notes (content) and
 * review every release variant attached to this episode.
 */
export default async function AdminEpisodePage({ params }: PageProps) {
  const { id } = await params;
  const episodeId = Number(id);
  if (!Number.isInteger(episodeId) || episodeId <= 0) notFound();

  const row = await loadEpisode(episodeId);
  if (!row) notFound();
  const { episode, series } = row;

  const locale = await getLocale();
  const t = await getTranslations("admin");
  const tAnime = await getTranslations("anime");

  const torrents = await db
    .select()
    .from(torrentItems)
    .where(eq(torrentItems.episodeId, episodeId))
    .orderBy(desc(torrentItems.publishTime), desc(torrentItems.createdAt));

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb
        items={[
          { label: t("animeTitle"), href: "/admin/anime" },
          { label: series.title, href: `/anime/${series.id}` },
          { label: tAnime("episodeTitle", { episode: episode.number }) },
        ]}
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{series.title}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            {t("episodeTitle")} · {tAnime("episodeTitle", { episode: episode.number })}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
            <Badge variant="outline">{tAnime("seasonLabel", { season: series.season })}</Badge>
            {series.year ? <Badge variant="outline">{series.year}</Badge> : null}
            <Badge variant="outline">{tAnime("variantCount", { count: torrents.length })}</Badge>
            <Badge variant="outline">
              {t("updatedAt")}: {formatDateTime(episode.updatedAt, locale)}
            </Badge>
          </div>
        </div>
        <Link
          href={`/episode/${episode.id}`}
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {t("viewPublic")}
        </Link>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
            {t("coverSection")}
            <Link
              href={`/admin/contents?anime=${series.id}`}
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              {t("contentsLink")}
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EpisodeCoverForm episodeId={episode.id} coverUrl={episode.coverUrl} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("variantsSection")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col">
          {torrents.length === 0 ? (
            <EmptyState
              icon={<Tv className="size-5" />}
              title={tAnime("noTorrents")}
              description={tAnime("noTorrentsHint")}
              className="border-0 py-8"
            />
          ) : (
            torrents.map((torrent) => (
              <div
                key={torrent.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b py-2.5 last:border-0 last:pb-0 first:pt-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="max-w-[36rem] truncate text-sm font-medium" title={torrent.title}>
                    {torrent.title}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    {torrent.subgroup ?? extractSubgroup(torrent.title) ? (
                      <Badge variant="outline">
                        {torrent.subgroup ?? extractSubgroup(torrent.title)}
                      </Badge>
                    ) : null}
                    {torrent.resolution ? (
                      <Badge variant="outline">{torrent.resolution}</Badge>
                    ) : null}
                    <span>{formatBytes(torrent.size)}</span>
                    <span>·</span>
                    <span>{formatDateTime(torrent.publishTime ?? torrent.createdAt, locale)}</span>
                  </div>
                </div>
                <TorrentRowActions magnet={torrent.magnet} torrentUrl={torrent.torrentUrl} />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
