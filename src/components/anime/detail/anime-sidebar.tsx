import { useTranslations } from "next-intl";
import { ListVideo, Magnet, Sparkles } from "lucide-react";
import { AnimePoster } from "@/components/anime/detail/anime-poster";
import { StatTile } from "@/components/anime/detail/stat-tile";
import { BasicInfoCard } from "@/components/anime/detail/basic-info-card";
import type { AnimeWithTitle } from "@/db/schema";

/** Left column of the detail page: poster, quick stats and basic info. */
export function AnimeSidebar({
  item,
  primaryTitle,
  synonyms,
  episodeCount,
  torrentCount,
  latestEpisode,
}: {
  item: AnimeWithTitle;
  primaryTitle: string;
  synonyms: string[];
  episodeCount: number;
  torrentCount: number;
  latestEpisode: number | null;
}) {
  const t = useTranslations("anime");

  return (
    <aside className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <AnimePoster title={item.title} coverUrl={item.coverUrl} />
        <div className="grid grid-cols-3 gap-2">
          <StatTile
            icon={<ListVideo />}
            value={String(episodeCount)}
            label={t("statEpisodes")}
          />
          <StatTile
            icon={<Magnet />}
            value={String(torrentCount)}
            label={t("statTorrents")}
          />
          <StatTile
            icon={<Sparkles />}
            value={latestEpisode != null ? String(latestEpisode) : "-"}
            label={t("statLatest")}
          />
        </div>
      </div>

      <BasicInfoCard item={item} primaryTitle={primaryTitle} synonyms={synonyms} />
    </aside>
  );
}
