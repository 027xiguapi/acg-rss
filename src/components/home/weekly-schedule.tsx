import { getTranslations } from "next-intl/server";
import type { BangumiCardData } from "@/server/bangumi/queries";
import { Badge } from "@/components/ui/badge";
import { BangumiCardGrid } from "@/components/home/bangumi-card-grid";

/** Default mode: one section per weekly air day that has entries (Sunday
 *  first), then movie / OVA categories. Unscheduled entries are not shown.
 *  Each section carries a `data-row-N` anchor id that the header DayNav
 *  scrolls to (0=Sun … 6=Sat, 7=movie, 8=OVA, Mikan-style). */
export async function WeeklySchedule({
  daySections,
  movie,
  ova,
}: {
  daySections: { day: number; entries: BangumiCardData[] }[];
  movie: BangumiCardData[];
  ova: BangumiCardData[];
}) {
  const tHome = await getTranslations("home");
  const tBangumi = await getTranslations("bangumi");
  const todayIso = ((new Date().getDay() + 6) % 7) + 1;

  return (
    <div className="flex flex-col gap-8">
      {daySections.map(({ day, entries }) => (
        <section
          key={day}
          id={`data-row-${day % 7}`}
          className="flex scroll-mt-28 flex-col gap-3"
        >
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <span className="h-4 w-1 rounded-full bg-primary" />
            {tBangumi(`weekdays.${day}`)}
            <span className="text-sm font-normal text-muted-foreground">
              {entries.length}
            </span>
            {day === todayIso ? (
              <Badge variant="secondary">{tHome("today")}</Badge>
            ) : null}
          </h2>
          <BangumiCardGrid entries={entries} />
        </section>
      ))}

      {movie.length > 0 ? (
        <section id="data-row-7" className="flex scroll-mt-28 flex-col gap-3">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <span className="h-4 w-1 rounded-full bg-primary" />
            {tBangumi("types.MOVIE")}
            <span className="text-sm font-normal text-muted-foreground">
              {movie.length}
            </span>
          </h2>
          <BangumiCardGrid entries={movie} />
        </section>
      ) : null}

      {ova.length > 0 ? (
        <section id="data-row-8" className="flex scroll-mt-28 flex-col gap-3">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <span className="h-4 w-1 rounded-full bg-primary" />
            {tBangumi("types.OVA")}
            <span className="text-sm font-normal text-muted-foreground">
              {ova.length}
            </span>
          </h2>
          <BangumiCardGrid entries={ova} />
        </section>
      ) : null}
    </div>
  );
}
