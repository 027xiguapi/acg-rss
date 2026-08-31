import { getTranslations } from "next-intl/server";
import { History } from "lucide-react";
import type { BangumiCardData } from "@/server/bangumi/queries";
import { BangumiCardGrid } from "@/components/home/bangumi-card-grid";

/** Newest-releases shelf: the most recently updated series as a card grid. */
export async function RecentUpdates({ entries }: { entries: BangumiCardData[] }) {
  if (entries.length === 0) return null;
  const tHome = await getTranslations("home");

  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <span className="h-4 w-1 rounded-full bg-primary" />
        <History className="size-4" />
        {tHome("recent")}
      </h2>
      <BangumiCardGrid entries={entries} />
    </section>
  );
}
