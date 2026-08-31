"use client";

import { Calendar } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Select } from "@/components/ui/select";

/**
 * Air-year dropdown for the public index. Selecting a year navigates with
 * `?year=…` while preserving the current text search, so the two filters
 * compose; picking the placeholder clears the year.
 */
export function YearFilter({
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
    <div className="relative shrink-0">
      <Calendar className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Select
        value={selected != null ? String(selected) : ""}
        onChange={(e) => onChange(e.target.value)}
        aria-label={allLabel}
        className="h-9 w-32 pl-8"
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
