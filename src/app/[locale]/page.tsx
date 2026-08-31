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
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

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
  searchParams: Promise<{ q?: string; year?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { q, year: yearParam } = await searchParams;
  const query = (q ?? "").trim();
  const yearNum = Number(yearParam);
  const year = Number.isInteger(yearNum) && yearNum > 0 ? yearNum : null;

  const user = await getSessionUser();
  const [tHome, tCommon, index] = await Promise.all([
    getTranslations("home"),
    getTranslations("common"),
    getBangumiIndex(query, year),
  ]);

  // Unscheduled entries are not rendered, so the empty state has to key off
  // the sections that actually appear on the schedule.
  const scheduledCount =
    index.daySections.length + index.movie.length + index.ova.length;

  return (
    <div className="flex min-h-screen flex-col">
      <HomeHeader user={user} query={query} year={year} years={index.years} />
      <DayNav />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {query ? (
          <SearchResults query={query} results={index.results} />
        ) : scheduledCount === 0 ? (
          <EmptyState
            icon={<Tv className="size-5" />}
            title={tHome("empty")}
            action={
              year != null ? (
                <Link
                  href="/"
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                >
                  {tHome("clearFilter")}
                </Link>
              ) : user?.role === "admin" ? (
                <BangumiFormDialog />
              ) : undefined
            }
          />
        ) : (
          <WeeklySchedule
            daySections={index.daySections}
            movie={index.movie}
            ova={index.ova}
          />
        )}
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        {tCommon("appName")} · {tCommon("tagline")}
      </footer>
    </div>
  );
}
