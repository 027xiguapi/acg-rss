import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Tv } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { Breadcrumb } from "@/components/breadcrumb";
import { AnimeSidebar } from "@/components/anime/detail/anime-sidebar";
import { AnimeHeader } from "@/components/anime/detail/anime-header";
import { DetailActions } from "@/components/anime/detail/detail-actions";
import { EpisodePicker } from "@/components/anime/detail/episode-picker";
import { EpisodeSection } from "@/components/anime/detail/episode-section";
import { RelatedGrid } from "@/components/anime/detail/related-grid";
import { loadAnime, loadAnimeDetail } from "@/server/anime/detail";
import { getAdminUser } from "@/server/auth/session";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const row = await loadAnime(Number(id));
  return { title: row?.title ?? "Anime" };
}

/**
 * AGE-style anime detail page: sidebar with poster, stat tiles, basic info
 * and related recommendations; main column with introduction, play/download
 * actions, an episode picker, and the full per-episode release list
 * (subgroup / resolution / size). Episodes come from anime_episodes;
 * torrents whose episode number could not be parsed are grouped at the end.
 */
export default async function AnimeDetailPage({ params }: PageProps) {
  const { id } = await params;
  const animeId = Number(id);
  if (!Number.isInteger(animeId) || animeId <= 0) notFound();

  const detail = await loadAnimeDetail(animeId);
  if (!detail) notFound();
  const { item } = detail;

  const admin = await getAdminUser();
  const t = await getTranslations("anime");

  const hasContent = detail.episodes.length > 0 || detail.unparsed.length > 0;

  const introMeta = t("introMeta", {
    title: item.title,
    type: item.type ?? "none",
    typeLabel: item.type ? t(`types.${item.type}`) : "",
    origin: item.origin ?? "none",
    originLabel: item.origin ? t(`origins.${item.origin}`) : "",
    year: item.year != null ? String(item.year) : "none",
    airDay: item.airDay != null ? String(item.airDay) : "none",
    airDayLabel: item.airDay ? t(`weekdays.${item.airDay}`) : "",
    season: item.season,
    statusLabel: t(`status.${item.watchStatus}`),
  });

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb
        items={[
          { label: t("title"), href: "/anime" },
          { label: item.title },
        ]}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <AnimeSidebar
          item={item}
          primaryTitle={detail.primaryTitle}
          synonyms={detail.synonyms}
          episodeCount={detail.episodes.length}
          torrentCount={detail.torrentCount}
          latestEpisode={detail.latestEpisode}
        />

        <div className="flex min-w-0 max-w-[1024px] flex-col gap-5">
          <AnimeHeader
            item={item}
            episodeCount={detail.episodes.length}
            torrentCount={detail.torrentCount}
          />

          <section className="flex flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
            <p>{introMeta}</p>
            <p>
              {t("introBody", {
                episodes: detail.episodes.length,
                torrents: detail.torrentCount,
              })}
            </p>
          </section>

          <DetailActions
            episodeId={detail.firstEpisode?.id ?? null}
            downloadHref={detail.bestHref}
          />

          {detail.episodesAsc.length > 0 ? (
            <EpisodePicker episodes={detail.episodesAsc} />
          ) : null}

          {hasContent ? (
            <div className="flex flex-col gap-3">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <span className="h-4 w-1 rounded-full bg-primary" />
                {t("releases")}
                <span className="text-sm font-normal text-muted-foreground">
                  {t("episodesCollected", { count: detail.torrentCount })}
                </span>
              </h2>
              {detail.episodes.map((episode) => (
                <EpisodeSection
                  key={episode.id}
                  label={t("episodeTitle", { episode: episode.number })}
                  href={`/episode/${episode.id}`}
                  manageHref={admin ? `/admin/episode/${episode.id}` : undefined}
                  torrents={episode.torrents}
                />
              ))}
              {detail.unparsed.length > 0 ? (
                <EpisodeSection label={t("unknownEpisode")} torrents={detail.unparsed} />
              ) : null}
            </div>
          ) : (
            <EmptyState
              icon={<Tv className="size-5" />}
              title={t("noTorrents")}
              description={t("noTorrentsHint")}
            />
          )}
        </div>

        <RelatedGrid entries={detail.related} />
      </div>
    </div>
  );
}
