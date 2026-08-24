import { useTranslations } from "next-intl";
import { Download, Play } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

/** Play / download-latest CTAs shown above the episode list. */
export function DetailActions({
  episodeId,
  downloadHref,
}: {
  /** First episode page, when the series has parsed episodes. */
  episodeId: number | null;
  /** Newest release that has a magnet or .torrent link. */
  downloadHref: string | null;
}) {
  const t = useTranslations("anime");
  if (!episodeId && !downloadHref) return null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {episodeId ? (
        <Link href={`/episode/${episodeId}`} className={cn(buttonVariants())}>
          <Play />
          {t("play")}
        </Link>
      ) : null}
      {downloadHref ? (
        <a href={downloadHref} className={cn(buttonVariants({ variant: "outline" }))}>
          <Download />
          {t("downloadLatest")}
        </a>
      ) : null}
      <p className="min-w-0 flex-1 basis-40 text-xs leading-relaxed text-muted-foreground">
        {t("downloadHint")}
      </p>
    </div>
  );
}
