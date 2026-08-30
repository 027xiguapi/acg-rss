import { getTranslations, setRequestLocale } from "next-intl/server";
import { Tv } from "lucide-react";
import { getBangumiIndex } from "@/server/bangumi/queries";
import { getSessionUser } from "@/server/auth/session";
import { BangumiFormDialog } from "@/components/bangumi/bangumi-form-dialog";
import { HomeHeader } from "@/components/home/home-header";
import { SearchResults } from "@/components/home/search-results";
import { WeeklySchedule } from "@/components/home/weekly-schedule";
import { EmptyState } from "@/components/empty-state";
import { DayNav } from "@/components/home/day-nav";

/**
 * Mikan-style public index: tracked bangumi grouped by weekly air day, with a
 * title search and login/register in the header. Public for everyone; the
 * management view lives at /bangumi.
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
    getBangumiIndex(query),
  ]);

  return (
    <div className="flex min-h-screen flex-col">
      <HomeHeader user={user} query={query} />
      <DayNav />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {query ? (
          <SearchResults query={query} results={index.results} />
        ) : index.total === 0 ? (
          <EmptyState
            icon={<Tv className="size-5" />}
            title={tHome("empty")}
            action={user?.role === "admin" ? <BangumiFormDialog /> : undefined}
          />
        ) : (
          <WeeklySchedule
            daySections={index.daySections}
            movie={index.movie}
            ova={index.ova}
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
