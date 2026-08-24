import type { BangumiCardData } from "@/server/bangumi/queries";
import { BangumiCard } from "@/components/home/bangumi-card";

const CARD_GRID =
  "grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6";

/** Responsive poster grid shared by all index sections. */
export function BangumiCardGrid({ entries }: { entries: BangumiCardData[] }) {
  return (
    <div className={CARD_GRID}>
      {entries.map((entry) => (
        <BangumiCard key={entry.item.id} entry={entry} />
      ))}
    </div>
  );
}
