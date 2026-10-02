import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Tv } from "lucide-react";
import {
  getBangumiIndex,
  getRecentBangumi,
  getUserFavorites,
} from "@/server/bangumi/queries";
import { getSessionUser } from "@/server/auth/session";
import { BangumiFormDialog } from "@/components/bangumi/bangumi-form-dialog";
import { SearchResults } from "@/components/home/search-results";
import { WeeklySchedule } from "@/components/home/weekly-schedule";
import { EmptyState } from "@/components/empty-state";
import { DayNav } from "@/components/home/day-nav";
import { RecentUpdates } from "@/components/home/recent-updates";
import { UserFavorites } from "@/components/home/user-favorites";
import { JsonLd } from "@/components/seo/json-ld";
import { Link } from "@/i18n/navigation";
import { SITE_URL } from "@/lib/site";
import { languageAlternates, localePathUrl } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    alternates: {
      canonical: localePathUrl("/", locale),
      languages: languageAlternates("/"),
    },
    openGraph: { url: localePathUrl("/", locale) },
  };
}

/**
 * Mikan-style public index, now rendered inside the shared (app) AppShell.
 * The shell provides the header, so this page only supplies the day tabs,
 * the title search bar and the schedule / search results.
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
  const [tHome, tMeta, index, recent, favorites] = await Promise.all([
    getTranslations("home"),
    getTranslations("Metadata"),
    getBangumiIndex(query, year),
    getRecentBangumi(),
    user ? getUserFavorites(user.id) : Promise.resolve([]),
  ]);

  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "wami-acg",
    url: SITE_URL,
    inLanguage: ["en", "zh-CN", "ja", "ko"],
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  // Unscheduled entries are not rendered, so the empty state has to key off
  // the sections that actually appear on the schedule.
  const scheduledCount =
    index.daySections.length + index.movie.length + index.ova.length;

  // Anchor ids WeeklySchedule actually renders, for the DayNav tabs
  // (daySections days are 1=Mon … 7=Sun, mirroring data-row-{day % 7})
  const presentRowIds = [
    ...index.daySections.map(({ day }) => day % 7),
    ...(index.movie.length > 0 ? [7] : []),
    ...(index.ova.length > 0 ? [8] : []),
  ];

  return (
    <>
      <JsonLd data={websiteJsonLd} />
      <h1 className="sr-only">{tMeta("title")}</h1>
      <DayNav
        years={index.years}
        year={year}
        query={query}
        allLabel={tHome("allYears")}
        presentIds={presentRowIds}
      />

      {query ? (
        <SearchResults query={query} results={index.results} />
      ) : (
        <div className="flex flex-col gap-8 mt-5">
          <RecentUpdates entries={recent} />
          <UserFavorites entries={favorites} authenticated={user != null} />

          {scheduledCount === 0 ? (
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
        </div>
      )}
    </>
  );
}
