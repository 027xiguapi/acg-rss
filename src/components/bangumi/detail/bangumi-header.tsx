import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { BangumiWithTitle } from "@/db/schema";

/** Series title with the season / year / type / status badges. */
export function BangumiHeader({
  item,
  episodeCount,
  torrentCount,
}: {
  item: BangumiWithTitle;
  episodeCount: number;
  torrentCount: number;
}) {
  const t = useTranslations("bangumi");

  return (
    <header className="flex flex-col gap-2">
      <h1 className="text-2xl font-bold tracking-tight">{item.title}</h1>
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <Badge variant="outline">{t("seasonLabel", { season: item.season })}</Badge>
        {item.year ? <Badge variant="outline">{item.year}</Badge> : null}
        {item.type ? <Badge variant="outline">{t(`types.${item.type}`)}</Badge> : null}
        {item.origin ? <Badge variant="outline">{t(`origins.${item.origin}`)}</Badge> : null}
        {item.airDay ? <Badge variant="outline">{t(`weekdays.${item.airDay}`)}</Badge> : null}
        <Badge variant={item.watchStatus === "WATCHING" ? "success" : "secondary"}>
          {t(`status.${item.watchStatus}`)}
        </Badge>
        <Badge variant="outline">{t("episodeCount", { count: episodeCount })}</Badge>
        <Badge variant="outline">{t("episodesCollected", { count: torrentCount })}</Badge>
      </div>
    </header>
  );
}
