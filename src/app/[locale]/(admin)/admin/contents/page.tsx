import type { Metadata } from "next";
import { asc, eq, inArray } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { FileText, Tv } from "lucide-react";
import { db } from "@/db";
import { anime, animeEpisodes, episodeInfos } from "@/db/schema";
import { withTitles } from "@/server/anime/queries";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { Breadcrumb } from "@/components/breadcrumb";
import { EpisodeInfosEditor } from "@/components/anime/episode-infos-editor";

export const metadata: Metadata = { title: "Episode Contents" };

interface PageProps {
  searchParams: Promise<{ anime?: string }>;
}

/**
 * Admin-only multilingual content management: pick a series, then edit
 * every episode's localized title and synopsis in one place. The public
 * episode page shows the row matching the visitor's locale and falls back
 * to any row.
 */
export default async function AdminContentsPage({ searchParams }: PageProps) {
  const { anime: animeParam } = await searchParams;
  const t = await getTranslations("admin");
  const tAnime = await getTranslations("anime");

  // Decorate with primary names from anime_infos, sorted by title
  const seriesList = await withTitles(await db.select().from(anime));
  if (seriesList.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold tracking-tight">{t("contentsTitle")}</h1>
        <EmptyState
          icon={<Tv className="size-5" />}
          title={t("noAnime")}
          description={t("contentsSubtitle")}
        />
      </div>
    );
  }

  const requested = Number(animeParam);
  const selected = seriesList.find((row) => row.id === requested) ?? seriesList[0];

  const episodes = await db
    .select()
    .from(animeEpisodes)
    .where(eq(animeEpisodes.animeId, selected.id))
    .orderBy(asc(animeEpisodes.number));

  const contentRows = episodes.length
    ? await db
        .select({
          episodeId: episodeInfos.episodeId,
          lang: episodeInfos.lang,
          title: episodeInfos.title,
          content: episodeInfos.content,
        })
        .from(episodeInfos)
        .where(
          inArray(
            episodeInfos.episodeId,
            episodes.map((episode) => episode.id)
          )
        )
        .orderBy(asc(episodeInfos.createdAt))
    : [];

  const byEpisode = new Map<
    number,
    { lang: string; title: string | null; content: string | null }[]
  >();
  for (const row of contentRows) {
    const list = byEpisode.get(row.episodeId) ?? [];
    list.push({ lang: row.lang, title: row.title, content: row.content });
    byEpisode.set(row.episodeId, list);
  }

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb
        items={[
          { label: t("animeTitle"), href: "/admin/anime" },
          { label: t("contentsTitle") },
        ]}
      />

      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("contentsTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("contentsSubtitle")}</p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {seriesList.map((series) => (
          <Link
            key={series.id}
            href={`/admin/contents?anime=${series.id}`}
            title={series.title}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              series.id === selected.id
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            {series.title}
          </Link>
        ))}
      </div>

      {episodes.length === 0 ? (
        <EmptyState
          icon={<FileText className="size-5" />}
          title={t("contentsEmpty")}
          description={t("contentsEmptyHint")}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {episodes.map((episode) => {
            const rows = byEpisode.get(episode.id) ?? [];
            return (
              <Card key={episode.id}>
                <CardContent className="flex flex-col gap-3 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link
                      href={`/admin/episode/${episode.id}`}
                      className="text-sm font-semibold underline-offset-4 hover:underline"
                    >
                      {tAnime("episodeTitle", { episode: episode.number })}
                    </Link>
                    <div className="flex flex-wrap items-center gap-1">
                      {rows.map((row) => (
                        <Badge key={row.lang} variant="secondary">
                          {row.lang}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <EpisodeInfosEditor episodeId={episode.id} initialRows={rows} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
