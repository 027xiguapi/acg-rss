"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";

/**
 * Compact title search in the shared header. Submitting navigates to the
 * home index with `?q=…`, where the search results render.
 */
export function HeaderSearch() {
  const tHome = useTranslations("home");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [value, setValue] = React.useState("");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = value.trim();
    router.push(q ? `/?q=${encodeURIComponent(q)}` : "/");
  }

  return (
    <form onSubmit={onSubmit} className="relative hidden md:block">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={tHome("searchPlaceholder")}
        aria-label={tCommon("search")}
        className="h-9 w-44 pl-8 sm:w-56"
      />
    </form>
  );
}
