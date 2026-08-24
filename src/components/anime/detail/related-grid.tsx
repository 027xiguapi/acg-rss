import { useTranslations } from "next-intl";
import { Heart } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { AnimePoster } from "@/components/anime/detail/anime-poster";
import type { RelatedEntry } from "@/server/anime/detail";

/**
 * Related recommendations. Rendered below the info card on wide screens,
 * last on mobile so episodes stay near the top.
 */
export function RelatedGrid({ entries }: { entries: RelatedEntry[] }) {
  const t = useTranslations("anime");
  const tHome = useTranslations("home");
  if (entries.length === 0) return null;

  return (
    <div className="lg:col-start-1 lg:row-start-2">
      <Card>
        <CardContent className="flex flex-col gap-3 p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Heart className="size-4 text-primary" />
            {t("related")}
          </h2>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-3">
            {entries.map(({ item, latest }) => (
              <Link
                key={item.id}
                href={`/anime/${item.id}`}
                title={item.title}
                className="relative block transition-transform hover:-translate-y-0.5"
              >
                {latest != null ? (
                  <span className="absolute left-1.5 top-1.5 z-10 rounded bg-black/55 px-1 py-0.5 text-[10px] font-medium text-white">
                    {tHome("latest", { episode: latest })}
                  </span>
                ) : null}
                <AnimePoster compact title={item.title} coverUrl={item.coverUrl} />
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
