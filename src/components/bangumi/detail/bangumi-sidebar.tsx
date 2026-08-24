import { useTranslations } from "next-intl";
import { ListVideo, Magnet, Sparkles } from "lucide-react";
import { BangumiPoster } from "@/components/bangumi/detail/bangumi-poster";
import { StatTile } from "@/components/bangumi/detail/stat-tile";
import { BasicInfoCard } from "@/components/bangumi/detail/basic-info-card";
import { RelatedGrid } from "@/components/bangumi/detail/related-grid";
import type { BangumiWithTitle } from "@/db/schema";
import type { RelatedEntry } from "@/server/bangumi/detail";

/** Left column of the detail page: poster, quick stats and basic info. */
export function BangumiSidebar({
  item,
  primaryTitle,
  synonyms,
  episodeCount,
  torrentCount,
  latestEpisode,
  related,
}: {
  item: BangumiWithTitle;
  primaryTitle: string;
  synonyms: string[];
  episodeCount: number;
  torrentCount: number;
  latestEpisode: number | null;
  related: RelatedEntry[];
}) {
  const t = useTranslations("bangumi");

  return (
    <aside className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <BangumiPoster title={item.title} coverUrl={item.coverUrl} />
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
      <RelatedGrid entries={related} />
    </aside>
  );
}
