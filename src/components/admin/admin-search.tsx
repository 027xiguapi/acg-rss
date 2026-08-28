import { getTranslations } from "next-intl/server";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

/**
 * GET search form for admin list pages. Submitting only carries the `q`
 * param, so the browser drops `page` and the list resets to page 1.
 */
export async function AdminSearch({ query }: { query: string }) {
  const tCommon = await getTranslations("common");

  return (
    <form method="get" className="relative w-full max-w-xs">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        name="q"
        defaultValue={query}
        placeholder={tCommon("search")}
        aria-label={tCommon("search")}
        className="h-9 pl-8"
      />
    </form>
  );
}
