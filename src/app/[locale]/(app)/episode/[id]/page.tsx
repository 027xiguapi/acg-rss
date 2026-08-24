import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ChevronLeft, ChevronRight, Download, Tv } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { Breadcrumb } from "@/components/breadcrumb";
import { BangumiSidebar } from "@/components/bangumi/detail/bangumi-sidebar";
import { EpisodePicker } from "@/components/bangumi/detail/episode-picker";
import { EpisodeSection } from "@/components/bangumi/detail/episode-section";
import { SocialBar } from "@/components/bangumi/detail/social-bar";
import { CommentSection } from "@/components/bangumi/detail/comment-section";
import { posterTint } from "@/lib/poster";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { loadEpisode, loadEpisodeDetail } from "@/server/bangumi/episode";
import { loadEpisodeSocial } from "@/server/bangumi/social";
import { getAdminUser, getSessionUser } from "@/server/auth/session";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const row = await loadEpisode(Number(id));
  return { title: row ? `${row.series.title} · #${row.episode.number}` : "Episode" };
}

/**
 * AGE-style episode detail page, mirroring the bangumi detail layout:
 * sidebar with poster, stats and basic info; main column with the episode
 * cover as a player-style banner, synopsis, prev/next + download actions,
 * an episode picker highlighting the current episode, and the release
 * variants of this episode (subgroup / resolution / size).
 */
export default async function EpisodeDetailPage({ params }: PageProps) {
  const { id } = await params;
  const episodeId = Number(id);
  if (!Number.isInteger(episodeId) || episodeId <= 0) notFound();

  const detail = await loadEpisodeDetail(episodeId);
  if (!detail) notFound();
  const { episode, series, seriesDetail } = detail;

  const admin = await getAdminUser();
  const user = await getSessionUser();
  const social = await loadEpisodeSocial(episodeId, user?.id ?? null);
  const locale = await getLocale();
  const t = await getTranslations("bangumi");

  // Localized title/synopsis: the visitor's locale first, then any language
  const info = detail.infos.find((row) => row.lang === locale) ?? detail.infos[0];
  const infoTitle = info?.title ?? null;
  const synopsis = info?.content ?? null;

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb
        items={[
          { label: t("title"), href: "/bangumi" },
          { label: series.title, href: `/bangumi/${series.id}` },
          { label: t("episodeTitle", { episode: episode.number }) },
        ]}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <BangumiSidebar
          item={series}
          primaryTitle={seriesDetail.primaryTitle}
          synonyms={seriesDetail.synonyms}
          episodeCount={seriesDetail.episodes.length}
          torrentCount={seriesDetail.torrentCount}
          latestEpisode={seriesDetail.latestEpisode}
          related={seriesDetail.related}
        />

        <div className="flex min-w-0 max-w-[1024px] flex-col gap-5">
          <header className="flex flex-col gap-2">
            <Link
              href={`/bangumi/${series.id}`}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {series.title}
            </Link>
            <h1 className="text-2xl font-bold tracking-tight">
              {infoTitle ?? t("episodeTitle", { episode: episode.number })}
            </h1>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <Badge variant="outline">{t("seasonLabel", { season: series.season })}</Badge>
              {series.year ? <Badge variant="outline">{series.year}</Badge> : null}
              <Badge variant="outline">{t("variantCount", { count: detail.torrents.length })}</Badge>
            </div>
          </header>

          <div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-muted shadow-sm">
            {episode.coverUrl ? (
              <Image
                src={episode.coverUrl}
                alt={t("episodeTitle", { episode: episode.number })}
                fill
                sizes="(max-width: 1024px) 100vw, 1024px"
                className="object-cover"
              />
            ) : (
              <div
                className={cn(
                  "absolute inset-0 flex items-center justify-center bg-gradient-to-br",
                  posterTint(series.title)
                )}
              >
                <Tv className="size-16 text-white/20" />
              </div>
            )}
          </div>

          <section className="flex flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
            <p>{t("episodeIntro")}</p>
            {synopsis ? <p className="whitespace-pre-line">{synopsis}</p> : null}
          </section>

          <div className="flex flex-wrap items-center gap-3">
            {detail.prev ? (
              <Link
                href={`/episode/${detail.prev.id}`}
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                <ChevronLeft />
                {t("prevEpisode")} · {detail.prev.number}
              </Link>
            ) : null}
            {detail.bestHref ? (
              <a href={detail.bestHref} className={cn(buttonVariants())}>
                <Download />
                {t("downloadLatest")}
              </a>
            ) : null}
            {detail.next ? (
              <Link
                href={`/episode/${detail.next.id}`}
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                {t("nextEpisode")} · {detail.next.number}
                <ChevronRight />
              </Link>
            ) : null}
            <p className="min-w-0 flex-1 basis-40 text-xs leading-relaxed text-muted-foreground">
              {t("downloadHint")}
            </p>
          </div>

          <SocialBar
            kind="episode"
            targetId={episodeId}
            favoriteCount={social.favoriteCount}
            likeCount={social.likeCount}
            favorited={social.favorited}
            liked={social.liked}
            authenticated={user != null}
          />

          {seriesDetail.episodesAsc.length > 0 ? (
            <EpisodePicker episodes={seriesDetail.episodesAsc} activeId={episodeId} />
          ) : null}

          {detail.torrents.length > 0 ? (
            <div className="flex flex-col gap-3">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <span className="h-4 w-1 rounded-full bg-primary" />
                {t("releases")}
              </h2>
              <EpisodeSection
                label={t("episodeTitle", { episode: episode.number })}
                manageHref={admin ? `/admin/episode/${episode.id}` : undefined}
                torrents={detail.torrents}
              />
            </div>
          ) : (
            <EmptyState
              icon={<Tv className="size-5" />}
              title={t("noTorrents")}
              description={t("noTorrentsHint")}
            />
          )}

          <CommentSection
            kind="episode"
            targetId={episodeId}
            comments={social.comments}
            authenticated={user != null}
          />
        </div>

      </div>
    </div>
  );
}
