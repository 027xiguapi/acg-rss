import { useLocale } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { TorrentRowActions } from "@/components/torrents/torrent-row-actions";
import { extractSubgroup } from "@/lib/parser";
import { formatBytes, formatDateTime } from "@/lib/format";
import type { TorrentItem } from "@/db/schema";

/** Display label for a normalized subtitle language tag. */
const LANGUAGE_LABELS: Record<string, string> = {
  "zh-Hans": "简中",
  "zh-Hant": "繁中",
  ja: "日文",
  en: "英文",
};

/** Suffix for the subtitle delivery format, appended to the language badge. */
const FORMAT_LABELS: Record<string, string> = {
  embedded: "内嵌",
  closed: "内封",
};

/** One release variant: title, subgroup / resolution / size / date + actions. */
export function TorrentReleaseRow({ torrent }: { torrent: TorrentItem }) {
  const locale = useLocale();
  const subgroup = torrent.subgroup ?? extractSubgroup(torrent.title);
  const languages = torrent.subtitleLanguages ?? [];
  const formatSuffix =
    torrent.subtitleFormat != null
      ? FORMAT_LABELS[torrent.subtitleFormat] ?? null
      : null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b py-2.5 last:border-0 last:pb-0 first:pt-0">
      <div className="min-w-0 flex-1">
        <p className="max-w-[36rem] truncate text-sm font-medium" title={torrent.title}>
          {torrent.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {subgroup ? <Badge variant="outline">{subgroup}</Badge> : null}
          {languages.length > 0 || formatSuffix ? (
            <Badge variant="secondary">
              {languages.length > 0
                ? languages.map((lang) => LANGUAGE_LABELS[lang] ?? lang).join("+")
                : null}
              {formatSuffix ? (languages.length > 0 ? `·${formatSuffix}` : formatSuffix) : null}
            </Badge>
          ) : null}
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
