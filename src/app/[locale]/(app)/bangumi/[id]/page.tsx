import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Tv } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { Breadcrumb } from "@/components/breadcrumb";
import { BangumiSidebar } from "@/components/bangumi/detail/bangumi-sidebar";
import { BangumiHeader } from "@/components/bangumi/detail/bangumi-header";
import { DetailActions } from "@/components/bangumi/detail/detail-actions";
import { EpisodePicker } from "@/components/bangumi/detail/episode-picker";
import { EpisodeSection } from "@/components/bangumi/detail/episode-section";
import { RelatedGrid } from "@/components/bangumi/detail/related-grid";
import { SocialBar } from "@/components/bangumi/detail/social-bar";
import { CommentSection } from "@/components/bangumi/detail/comment-section";
import { loadBangumi, loadBangumiDetail } from "@/server/bangumi/detail";
import { loadBangumiSocial } from "@/server/bangumi/social";
import { getAdminUser, getSessionUser } from "@/server/auth/session";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const row = await loadBangumi(Number(id));
  return { title: row?.title ?? "Bangumi" };
}

/**
 * AGE-style bangumi detail page: sidebar with poster, stat tiles, basic info
 * and related recommendations; main column with introduction, play/download
 * actions, an episode picker, and the full per-episode release list
 * (subgroup / resolution / size). Episodes come from bangumi_episodes;
 * torrents whose episode number could not be parsed are grouped at the end.
 */
export default async function BangumiDetailPage({ params }: PageProps) {
  const { id } = await params;
  const bangumiId = Number(id);
  if (!Number.isInteger(bangumiId) || bangumiId <= 0) notFound();

  const detail = await loadBangumiDetail(bangumiId);
  if (!detail) notFound();
  const { item } = detail;

  const admin = await getAdminUser();
  const user = await getSessionUser();
  const social = await loadBangumiSocial(bangumiId, user?.id ?? null);
  const t = await getTranslations("bangumi");

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
          { label: t("title"), href: "/bangumi" },
          { label: item.title },
        ]}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <BangumiSidebar
          item={item}
          primaryTitle={detail.primaryTitle}
          synonyms={detail.synonyms}
          episodeCount={detail.episodes.length}
          torrentCount={detail.torrentCount}
          latestEpisode={detail.latestEpisode}
        />

        <div className="flex min-w-0 max-w-[1024px] flex-col gap-5">
          <BangumiHeader
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

          <SocialBar
            kind="bangumi"
            targetId={bangumiId}
            favoriteCount={social.favoriteCount}
            likeCount={social.likeCount}
            favorited={social.favorited}
            liked={social.liked}
            authenticated={user != null}
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

          <CommentSection
            kind="bangumi"
            targetId={bangumiId}
            comments={social.comments}
            authenticated={user != null}
          />
        </div>

        <RelatedGrid entries={detail.related} />
      </div>
    </div>
  );
}
