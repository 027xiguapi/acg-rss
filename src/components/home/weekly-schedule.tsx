import { getTranslations } from "next-intl/server";
import type { AnimeCardData } from "@/server/anime/queries";
import { Badge } from "@/components/ui/badge";
import { AnimeCardGrid } from "@/components/home/anime-card-grid";

/** Default mode: one section per weekly air day plus "unscheduled" at the end. */
export async function WeeklySchedule({
  daySections,
  unscheduled,
}: {
  daySections: { day: number; entries: AnimeCardData[] }[];
  unscheduled: AnimeCardData[];
}) {
  const tHome = await getTranslations("home");
  const tAnime = await getTranslations("anime");
  // ISO weekday of today (1=Mon … 7=Sun)
  const todayIso = ((new Date().getDay() + 6) % 7) + 1;

  return (
    <div className="flex flex-col gap-8">
      {daySections.map(({ day, entries }) => (
        <section key={day} className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <span className="h-4 w-1 rounded-full bg-primary" />
            {tAnime(`weekdays.${day}`)}
            <span className="text-sm font-normal text-muted-foreground">
              {entries.length}
            </span>
            {day === todayIso ? (
              <Badge variant="secondary">{tHome("today")}</Badge>
            ) : null}
          </h2>
          {entries.length === 0 ? (
            <p className="rounded-lg border border-dashed px-4 py-6 text-center text-xs text-muted-foreground">
              {tHome("emptyDay")}
            </p>
          ) : (
            <AnimeCardGrid entries={entries} />
          )}
        </section>
      ))}

      {unscheduled.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <span className="h-4 w-1 rounded-full bg-muted-foreground" />
            {tHome("unscheduled")}
            <span className="text-sm font-normal text-muted-foreground">
              {unscheduled.length}
            </span>
          </h2>
          <AnimeCardGrid entries={unscheduled} />
        </section>
      ) : null}
    </div>
  );
}
