"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/**
 * Mikan-style category tabs under the header, shown on the homepage only.
 * Each tab scrolls to its `data-row-N` anchor (0=Sun … 6=Sat, 7=movie,
 * 8=OVA); tabs whose section is absent are hidden and the tab of the section
 * currently in view is highlighted. Every category keeps Mikan's distinct
 * accent color, filled in when active.
 */

type TabAccent = {
  id: number;
  abbr: string;
  day?: number;
  /** Static Tailwind class groups so JIT can see them */
  text: string;
  border: string;
  bg: string;
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
  },
  {
    id: 6,
    abbr: "Sat",
    day: 6,
    text: "text-blue-600 dark:text-blue-400",
    border: "border-blue-600 dark:border-blue-400",
    bg: "bg-blue-600 dark:bg-blue-500",
  },
  {
    id: 5,
    abbr: "Fri",
    day: 5,
    text: "text-orange-600 dark:text-orange-400",
    border: "border-orange-600 dark:border-orange-400",
    bg: "bg-orange-600 dark:bg-orange-500",
  },
  {
    id: 4,
    abbr: "Thu",
    day: 4,
    text: "text-green-600 dark:text-green-400",
    border: "border-green-600 dark:border-green-400",
    bg: "bg-green-600 dark:bg-green-500",
  },
  {
    id: 3,
    abbr: "Wed",
    day: 3,
    text: "text-yellow-600 dark:text-yellow-400",
    border: "border-yellow-600 dark:border-yellow-400",
    bg: "bg-yellow-600 dark:bg-yellow-500",
  },
  {
    id: 2,
    abbr: "Tue",
    day: 2,
    text: "text-teal-600 dark:text-teal-400",
    border: "border-teal-600 dark:border-teal-400",
    bg: "bg-teal-600 dark:bg-teal-500",
  },
  {
    id: 1,
    abbr: "Mon",
    day: 1,
    text: "text-red-600 dark:text-red-400",
    border: "border-red-600 dark:border-red-400",
    bg: "bg-red-600 dark:bg-red-500",
  },
];

const MOVIE_TAB: TabAccent = {
  id: 7,
  abbr: "Mov",
  text: "text-indigo-600 dark:text-indigo-400",
  border: "border-indigo-600 dark:border-indigo-400",
  bg: "bg-indigo-600 dark:bg-indigo-500",
};

const OVA_TAB: TabAccent = {
  id: 8,
  abbr: "OVA",
  text: "text-sky-600 dark:text-sky-400",
  border: "border-sky-600 dark:border-sky-400",
  bg: "bg-sky-600 dark:bg-sky-500",
};

const ALL_ROW_IDS = [0, 1, 2, 3, 4, 5, 6, 7, 8];

export function DayNav() {
  const tBangumi = useTranslations("bangumi");
  const [active, setActive] = React.useState<number | null>(null);
  const [presentIds, setPresentIds] = React.useState<Set<number>>(new Set());

  React.useEffect(() => {
    const found = ALL_ROW_IDS.filter((id) =>
      document.getElementById(`data-row-${id}`)
    );
    setPresentIds(new Set(found));
    if (found.length === 0) return;

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
    for (const id of found) {
      observer.observe(document.getElementById(`data-row-${id}`)!);
    }
    return () => observer.disconnect();
    // Sections exist per homepage render; the component remounts on navigation
  }, []);

  function handleClick(id: number) {
    setActive(id);
    document
      .getElementById(`data-row-${id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (presentIds.size === 0) return null;

  const tabs = [
    ...DAY_TABS.filter((tab) => presentIds.has(tab.id)).map((tab) => ({
      ...tab,
      label: tBangumi(`weekdays.${tab.day!}`),
    })),
    ...(presentIds.has(7)
      ? [{ ...MOVIE_TAB, label: tBangumi("types.MOVIE") }]
      : []),
    ...(presentIds.has(8) ? [{ ...OVA_TAB, label: tBangumi("types.OVA") }] : []),
  ];

  return (
    <nav className="border-t bg-background">
      {/* Rainbow strip, Mikan-style */}
      <div
        className="h-0.5 w-full"
        style={{
          background:
            "linear-gradient(to right, #9333ea, #2563eb, #ea580c, #16a34a, #ca8a04, #0d9488, #dc2626)",
        }}
      />
      <div className="mx-auto w-full max-w-6xl overflow-x-auto px-4 sm:px-6 lg:px-8">
        <ul className="flex items-center gap-1.5 py-1.5">
          {tabs.map(({ id, abbr, label, text, border, bg }) => {
            const isActive = active === id;
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => handleClick(id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-2.5 transition-colors",
                    isActive
                      ? cn(bg, "text-white")
                      : "hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold uppercase",
                      isActive ? "border-white/70 text-white" : cn(border, text)
                    )}
                  >
                    {abbr}
                  </span>
                  <span
                    className={cn(
                      "whitespace-nowrap text-xs font-medium",
                      isActive ? "text-white" : text
                    )}
                  >
                    {label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
