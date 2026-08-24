import type { AnimeCardData } from "@/server/anime/queries";
import { AnimeCard } from "@/components/home/anime-card";

const CARD_GRID =
  "grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6";

/** Responsive poster grid shared by all index sections. */
export function AnimeCardGrid({ entries }: { entries: AnimeCardData[] }) {
  return (
    <div className={CARD_GRID}>
      {entries.map((entry) => (
        <AnimeCard key={entry.item.id} entry={entry} />
      ))}
    </div>
  );
}
