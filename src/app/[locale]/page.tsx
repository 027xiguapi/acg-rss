import { getTranslations, setRequestLocale } from "next-intl/server";
import { Tv } from "lucide-react";
import { getAnimeIndex } from "@/server/anime/queries";
import { getSessionUser } from "@/server/auth/session";
import { AnimeFormDialog } from "@/components/anime/anime-form-dialog";
import { HomeHeader } from "@/components/home/home-header";
import { SearchResults } from "@/components/home/search-results";
import { WeeklySchedule } from "@/components/home/weekly-schedule";
import { EmptyState } from "@/components/empty-state";

/**
 * Mikan-style public index: tracked anime grouped by weekly air day, with a
 * title search and login/register in the header. Public for everyone; the
 * management view lives at /anime.
 */
export default async function HomePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  const user = await getSessionUser();
  const [tHome, tCommon, index] = await Promise.all([
    getTranslations("home"),
    getTranslations("common"),
    getAnimeIndex(query),
  ]);

  return (
    <div className="flex min-h-screen flex-col">
      <HomeHeader user={user} query={query} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {query ? (
          <SearchResults query={query} results={index.results} />
        ) : index.total === 0 ? (
          <EmptyState
            icon={<Tv className="size-5" />}
            title={tHome("empty")}
            action={user?.role === "admin" ? <AnimeFormDialog /> : undefined}
          />
        ) : (
          <WeeklySchedule
            daySections={index.daySections}
            unscheduled={index.unscheduled}
          />
        )}
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        {tCommon("appName")} · {tCommon("tagline")}
      </footer>
    </div>
  );
}
