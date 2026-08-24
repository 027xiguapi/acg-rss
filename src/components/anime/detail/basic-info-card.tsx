import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import type { Anime } from "@/db/schema";

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex gap-3 border-b py-1.5 text-sm leading-snug last:border-0">
      <dt className="w-24 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 break-words">{value ?? "-"}</dd>
    </div>
  );
}

/** Sidebar card listing the structured metadata of a series. */
export function BasicInfoCard({
  item,
  primaryTitle,
  synonyms,
}: {
  item: Anime;
  primaryTitle: string;
  synonyms: string[];
}) {
  const t = useTranslations("anime");

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <span className="h-4 w-1 rounded-full bg-primary" />
          {t("basicInfo")}
        </h2>
        <dl className="flex flex-col">
          <InfoRow
            label={t("origin")}
            value={item.origin ? t(`origins.${item.origin}`) : null}
          />
          <InfoRow
            label={t("kind")}
            value={item.type ? t(`types.${item.type}`) : null}
          />
          <InfoRow label={t("season")} value={t("seasonLabel", { season: item.season })} />
          <InfoRow label={t("year")} value={item.year != null ? String(item.year) : null} />
          <InfoRow
            label={t("airDay")}
            value={item.airDay ? t(`weekdays.${item.airDay}`) : null}
          />
          <InfoRow label={t("watchStatus")} value={t(`status.${item.watchStatus}`)} />
          <InfoRow label={t("originalName")} value={primaryTitle} />
          <InfoRow
            label={t("names")}
            value={synonyms.length > 0 ? synonyms.join(" / ") : null}
          />
        </dl>
      </CardContent>
    </Card>
  );
}
