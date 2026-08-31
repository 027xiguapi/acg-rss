"use client";

import * as React from "react";
import { Calendar } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Select } from "@/components/ui/select";

/**
 * Mikan-style category tabs, sticky under the header on the homepage only.
 * Each tab scrolls to its `data-row-N` anchor (0=Sun … 6=Sat, 7=movie,
 * 8=OVA); the page passes the ids that actually render, and the tab of the
 * section currently in view is highlighted via an IntersectionObserver.
 * Every category keeps Mikan's distinct accent color: active sections fill
 * the whole pill, while today's weekday gets a middle tier — a soft accent
 * tint plus a filled abbreviation circle. The air-year filter sits
 * right-aligned in the same bar, and stays visible on its own in search
 * mode, where no day sections exist.
 */

type TabAccent = {
  id: number;
  abbr: string;
  day?: number;
  /** Static Tailwind class groups so JIT can see them */
  text: string;
  border: string;
  bg: string;
  /** Soft tinted wash of the accent color on hover while inactive */
  hoverBg: string;
  /** Persistent tint marking today's weekday while inactive */
  soft: string;
};

/** Weekday tabs in Mikan display order: Sunday-first, descending. */
const DAY_TABS: TabAccent[] = [
  {
    id: 0,
    abbr: "Sun",
    day: 7,
    text: "text-purple-600 dark:text-purple-400",
    border: "border-purple-600 dark:border-purple-400",
    bg: "bg-purple-600 dark:bg-purple-500",
    hoverBg: "hover:bg-purple-500/15 dark:hover:bg-purple-400/15",
    soft: "bg-purple-500/10 dark:bg-purple-400/10",
  },
  {
    id: 6,
    abbr: "Sat",
    day: 6,
    text: "text-blue-600 dark:text-blue-400",
    border: "border-blue-600 dark:border-blue-400",
    bg: "bg-blue-600 dark:bg-blue-500",
    hoverBg: "hover:bg-blue-500/15 dark:hover:bg-blue-400/15",
    soft: "bg-blue-500/10 dark:bg-blue-400/10",
  },
  {
    id: 5,
    abbr: "Fri",
    day: 5,
    text: "text-orange-600 dark:text-orange-400",
    border: "border-orange-600 dark:border-orange-400",
    bg: "bg-orange-600 dark:bg-orange-500",
    hoverBg: "hover:bg-orange-500/15 dark:hover:bg-orange-400/15",
    soft: "bg-orange-500/10 dark:bg-orange-400/10",
  },
  {
    id: 4,
    abbr: "Thu",
    day: 4,
    text: "text-green-600 dark:text-green-400",
    border: "border-green-600 dark:border-green-400",
    bg: "bg-green-600 dark:bg-green-500",
    hoverBg: "hover:bg-green-500/15 dark:hover:bg-green-400/15",
    soft: "bg-green-500/10 dark:bg-green-400/10",
  },
  {
    id: 3,
    abbr: "Wed",
    day: 3,
    text: "text-yellow-600 dark:text-yellow-400",
    border: "border-yellow-600 dark:border-yellow-400",
    bg: "bg-yellow-600 dark:bg-yellow-500",
    hoverBg: "hover:bg-yellow-500/15 dark:hover:bg-yellow-400/15",
    soft: "bg-yellow-500/10 dark:bg-yellow-400/10",
  },
  {
    id: 2,
    abbr: "Tue",
    day: 2,
    text: "text-teal-600 dark:text-teal-400",
    border: "border-teal-600 dark:border-teal-400",
    bg: "bg-teal-600 dark:bg-teal-500",
    hoverBg: "hover:bg-teal-500/15 dark:hover:bg-teal-400/15",
    soft: "bg-teal-500/10 dark:bg-teal-400/10",
  },
  {
    id: 1,
    abbr: "Mon",
    day: 1,
    text: "text-red-600 dark:text-red-400",
    border: "border-red-600 dark:border-red-400",
    bg: "bg-red-600 dark:bg-red-500",
    hoverBg: "hover:bg-red-500/15 dark:hover:bg-red-400/15",
    soft: "bg-red-500/10 dark:bg-red-400/10",
  },
];

const MOVIE_TAB: TabAccent = {
  id: 7,
  abbr: "Mov",
  text: "text-indigo-600 dark:text-indigo-400",
  border: "border-indigo-600 dark:border-indigo-400",
  bg: "bg-indigo-600 dark:bg-indigo-500",
  hoverBg: "hover:bg-indigo-500/15 dark:hover:bg-indigo-400/15",
  soft: "bg-indigo-500/10 dark:bg-indigo-400/10",
};

const OVA_TAB: TabAccent = {
  id: 8,
  abbr: "OVA",
  text: "text-sky-600 dark:text-sky-400",
  border: "border-sky-600 dark:border-sky-400",
  bg: "bg-sky-600 dark:bg-sky-500",
  hoverBg: "hover:bg-sky-500/15 dark:hover:bg-sky-400/15",
  soft: "bg-sky-500/10 dark:bg-sky-400/10",
};

/** No-op subscription: the weekday only rolls over at midnight, not worth a timer */
const subscribeNoop = () => () => {};

/**
 * Air-year dropdown for the public index. Selecting a year navigates with
 * `?year=…` while preserving the current text search, so the two filters
 * compose; picking the placeholder clears the year.
 */
function YearFilter({
  years,
  selected,
  query,
  allLabel,
}: {
  years: number[];
  selected: number | null;
  query: string;
  allLabel: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function onChange(value: string) {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (value) params.set("year", value);
    const qs = params.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ""}`);
  }

  return (
    <div className="relative ml-auto shrink-0">
      <Calendar className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Select
        value={selected != null ? String(selected) : ""}
        onChange={(e) => onChange(e.target.value)}
        aria-label={allLabel}
        className="h-9 w-28 pl-8 sm:w-32"
      >
        <option value="">{allLabel}</option>
        {years.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </Select>
    </div>
  );
}

export function DayNav({
  years,
  year,
  query,
  allLabel,
  presentIds,
}: {
  years: number[];
  year: number | null;
  query: string;
  allLabel: string;
  /** Row anchor ids rendered below (0=Sun … 6=Sat, 7=movie, 8=OVA) */
  presentIds: number[];
}) {
  const tBangumi = useTranslations("bangumi");
  const tHome = useTranslations("home");
  const [active, setActive] = React.useState<number | null>(null);
  // Row ids 0-6 mirror Date#getDay() (0=Sunday); read client-side only (the
  // server snapshot reports none) so differing server/client timezones can
  // never cause a hydration mismatch
  const todayId = React.useSyncExternalStore(
    subscribeNoop,
    () => new Date().getDay(),
    () => null
  );

  React.useEffect(() => {
    if (presentIds.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Highlight the topmost section currently in view
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top
          );
        if (visible[0]) {
          setActive(Number(visible[0].target.id.replace("data-row-", "")));
        }
      },
      // Skip the sticky header and only trigger near the top of a section
      { rootMargin: "-112px 0px -65% 0px" }
    );
    for (const id of presentIds) {
      const section = document.getElementById(`data-row-${id}`);
      if (section) observer.observe(section);
    }
    return () => observer.disconnect();
    // presentIds is stable per page render; navigation remounts the component
  }, [presentIds]);

  function handleClick(id: number) {
    setActive(id);
    document
      .getElementById(`data-row-${id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const hasTabs = presentIds.length > 0;
  if (!hasTabs && years.length === 0) return null;

  const tabs = [
    ...DAY_TABS.filter((tab) => presentIds.includes(tab.id)).map((tab) => ({
      ...tab,
      label: tBangumi(`weekdays.${tab.day!}`),
    })),
    ...(presentIds.includes(7)
      ? [{ ...MOVIE_TAB, label: tBangumi("types.MOVIE") }]
      : []),
    ...(presentIds.includes(8)
      ? [{ ...OVA_TAB, label: tBangumi("types.OVA") }]
      : []),
  ];

  return (
    <nav className="sticky top-14 z-10 border-b bg-background/80 backdrop-blur">
      {/* Rainbow strip, Mikan-style */}
      {hasTabs ? (
        <div
          className="h-0.5 w-full"
          style={{
            background:
              "linear-gradient(to right, #9333ea, #2563eb, #ea580c, #16a34a, #ca8a04, #0d9488, #dc2626)",
          }}
        />
      ) : null}
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3 py-2 px-4 sm:px-6 lg:px-8">
        {hasTabs ? (
          <div className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <ul className="flex items-center gap-1">
              {tabs.map(
                ({ id, abbr, label, text, border, bg, hoverBg, soft }) => {
                  const isActive = active === id;
                  const isToday = id === todayId;
                  return (
                    <li key={id} className="shrink-0">
                      <button
                        type="button"
                        onClick={() => handleClick(id)}
                        aria-current={
                          isActive ? "location" : isToday ? "date" : undefined
                        }
                        title={isToday ? tHome("today") : undefined}
                        className={cn(
                          "flex h-9 select-none items-center gap-1.5 rounded-full pl-1 pr-3 transition-all duration-200",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                          isActive
                            ? cn(bg, "text-white shadow-sm")
                            : isToday
                              ? cn(soft, hoverBg)
                              : hoverBg
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold uppercase transition-colors duration-200",
                            isActive
                              ? "border-white/40 bg-white/15 text-white"
                              : isToday
                                ? cn("border-transparent", bg, "text-white")
                                : cn(border, text)
                          )}
                        >
                          {abbr}
                        </span>
                        <span
                          className={cn(
                            "whitespace-nowrap text-xs font-medium transition-colors duration-200",
                            isActive
                              ? "text-white"
                              : isToday
                                ? cn(text, "font-semibold")
                                : text
                          )}
                        >
                          {label}
                        </span>
                      </button>
                    </li>
                  );
                }
              )}
            </ul>
          </div>
        ) : null}
        <YearFilter
          years={years}
          selected={year}
          query={query}
          allLabel={allLabel}
        />
      </div>
    </nav>
  );
}
