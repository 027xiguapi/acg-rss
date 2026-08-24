import { useTranslations } from "next-intl";
import { Download } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import type { EpisodeBucket } from "@/server/anime/detail";

/** Grid of episode-number buttons linking to episode pages, with quick download. */
export function EpisodePicker({
  episodes,
  activeId,
}: {
  episodes: Pick<EpisodeBucket, "id" | "number" | "href">[];
  /** Currently viewed episode, rendered as a highlighted non-link. */
  activeId?: number;
}) {
  const t = useTranslations("anime");
  const tCommon = useTranslations("common");

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <span className="h-4 w-1 rounded-full bg-primary" />
            {t("episodeSelect")}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t("episodeCount", { count: episodes.length })}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-5">
          {episodes.map((episode) => (
            <div
              key={episode.id}
              className="flex items-stretch overflow-hidden rounded-md border bg-card"
            >
              {episode.id === activeId ? (
                <span
                  aria-current="page"
                  className="flex flex-1 items-center justify-center bg-primary px-2 py-2 text-center text-sm font-medium text-primary-foreground"
                >
                  {t("episodeButton", {
                    episode: String(episode.number).padStart(2, "0"),
                  })}
                </span>
              ) : (
                <Link
                  href={`/episode/${episode.id}`}
                  className="flex flex-1 items-center justify-center px-2 py-2 text-center text-sm font-medium transition-colors hover:bg-accent"
                >
                  {t("episodeButton", {
                    episode: String(episode.number).padStart(2, "0"),
                  })}
                </Link>
              )}
              {episode.href ? (
                <a
                  href={episode.href}
                  aria-label={tCommon("download")}
                  title={tCommon("download")}
                  className="flex items-center border-l px-2.5 text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
                >
                  <Download className="size-3.5" />
                </a>
              ) : null}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
