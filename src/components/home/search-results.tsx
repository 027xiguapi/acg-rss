import { getTranslations } from "next-intl/server";
import { Search } from "lucide-react";
import type { AnimeCardData } from "@/server/anime/queries";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { AnimeCardGrid } from "@/components/home/anime-card-grid";

/** Search mode: flat grid of matches with a count and a clear button. */
export async function SearchResults({
  query,
  results,
}: {
  query: string;
  results: AnimeCardData[];
}) {
  const tHome = await getTranslations("home");
  const tCommon = await getTranslations("common");

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold tracking-tight">
          {tHome("searchResults", { q: query })}
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {results.length}
          </span>
        </h1>
        <Link
          href="/"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          {tHome("clearSearch")}
        </Link>
      </div>
      {results.length === 0 ? (
        <EmptyState
          icon={<Search className="size-5" />}
          title={tCommon("noResults")}
        />
      ) : (
        <AnimeCardGrid entries={results} />
      )}
    </section>
  );
}
