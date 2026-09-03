import { getTranslations } from "next-intl/server";
import Image from "next/image";
import { Tv } from "lucide-react";
import type { BangumiCardData } from "@/server/bangumi/queries";
import { posterTint } from "@/lib/poster";
import { resolveCover } from "@/lib/cover";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

/** Poster-style card: tinted cover with the title, meta badges underneath. */
export async function BangumiCard({ entry }: { entry: BangumiCardData }) {
  const { item, latest, coverName } = entry;
  const tHome = await getTranslations("home");
  const tBangumi = await getTranslations("bangumi");

  const cover = resolveCover(coverName, item.coverUrl);

  return (
    <Link
      href={`/bangumi/${item.id}`}
      className="group flex flex-col gap-2"
      title={item.title}
    >
      <div
        className={cn(
          "relative aspect-[2/3] overflow-hidden rounded-lg shadow-sm transition-all group-hover:-translate-y-1 group-hover:shadow-lg",
          cover
            ? "bg-muted"
            : cn("bg-gradient-to-br", posterTint(item.title))
        )}
      >
        {cover ? (
          <Image
            src={cover}
            alt={item.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 200px"
            className="object-cover"
          />
        ) : (
          <Tv className="absolute left-1/2 top-1/2 size-14 -translate-x-1/2 -translate-y-1/2 text-white/20" />
        )}
        {latest != null ? (
          <span className="absolute left-2 top-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[11px] font-medium text-white">
            {tHome("latest", { episode: latest })}
          </span>
        ) : null}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent p-2.5 pt-10">
          <p className="line-clamp-2 text-[13px] font-medium leading-snug text-white">
            {item.title}
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-1 px-0.5">
        <div className="flex flex-wrap items-center gap-1">
          {item.type ? (
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
              {tBangumi(`types.${item.type}`)}
            </Badge>
          ) : null}
          {item.origin ? (
            <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
              {tBangumi(`origins.${item.origin}`)}
            </Badge>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          {tBangumi("seasonLabel", { season: item.season })}
          {item.year ? ` · ${item.year}` : ""}
        </p>
      </div>
    </Link>
  );
}
