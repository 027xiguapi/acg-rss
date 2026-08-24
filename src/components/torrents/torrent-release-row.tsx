import { useLocale } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { TorrentRowActions } from "@/components/torrents/torrent-row-actions";
import { extractSubgroup } from "@/lib/parser";
import { formatBytes, formatDateTime } from "@/lib/format";
import type { TorrentItem } from "@/db/schema";

/** One release variant: title, subgroup / resolution / size / date + actions. */
export function TorrentReleaseRow({ torrent }: { torrent: TorrentItem }) {
  const locale = useLocale();
  const subgroup = torrent.subgroup ?? extractSubgroup(torrent.title);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b py-2.5 last:border-0 last:pb-0 first:pt-0">
      <div className="min-w-0 flex-1">
        <p className="max-w-[36rem] truncate text-sm font-medium" title={torrent.title}>
          {torrent.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {subgroup ? <Badge variant="outline">{subgroup}</Badge> : null}
          {torrent.resolution ? (
            <Badge variant="outline">{torrent.resolution}</Badge>
          ) : null}
          <span>{formatBytes(torrent.size)}</span>
          <span>·</span>
          <span>{formatDateTime(torrent.publishTime ?? torrent.createdAt, locale)}</span>
        </div>
      </div>
      <TorrentRowActions magnet={torrent.magnet} torrentUrl={torrent.torrentUrl} />
    </div>
  );
}
