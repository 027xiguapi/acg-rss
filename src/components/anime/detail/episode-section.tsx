import { useTranslations } from "next-intl";
import { Settings2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { TorrentReleaseRow } from "@/components/torrents/torrent-release-row";
import { extractSubgroup } from "@/lib/parser";
import type { TorrentItem } from "@/db/schema";

/**
 * All release variants of one episode (or of the "unknown episode" group),
 * with subgroup badges and a link to the per-episode page.
 */
export function EpisodeSection({
  label,
  href,
  manageHref,
  torrents,
}: {
  label: string;
  /** Link wrapping the heading (per-episode detail page) */
  href?: string;
  /** Admin-only link to the episode management page */
  manageHref?: string;
  torrents: TorrentItem[];
}) {
  const t = useTranslations("anime");
  const tAdmin = useTranslations("admin");

  const subgroups = new Set(
    torrents.map((torrent) => torrent.subgroup ?? extractSubgroup(torrent.title)).filter(Boolean)
  );

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {href ? (
              <Link href={href} className="font-semibold underline-offset-4 hover:underline">
                {label}
              </Link>
            ) : (
              <h3 className="font-semibold">{label}</h3>
            )}
            {manageHref ? (
              <Link
                href={manageHref}
                aria-label={tAdmin("manage")}
                title={tAdmin("manage")}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <Settings2 className="size-4" />
              </Link>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {[...subgroups].map((group) => (
              <Badge key={group} variant="secondary">
                {group}
              </Badge>
            ))}
            <Badge variant="outline">{t("variantCount", { count: torrents.length })}</Badge>
          </div>
        </div>

        {torrents.length === 0 ? (
          <p className="py-2 text-xs text-muted-foreground">{t("noTorrents")}</p>
        ) : (
          <div className="flex flex-col">
            {torrents.map((torrent) => (
              <TorrentReleaseRow key={torrent.id} torrent={torrent} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
