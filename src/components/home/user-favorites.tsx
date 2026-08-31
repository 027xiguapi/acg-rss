import { getTranslations } from "next-intl/server";
import { Star } from "lucide-react";
import type { BangumiCardData } from "@/server/bangumi/queries";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { BangumiCardGrid } from "@/components/home/bangumi-card-grid";

/** Personalized shelf: the signed-in user's favorited series. Anonymous
 *  visitors get a sign-in prompt instead of a list. */
export async function UserFavorites({
  entries,
  authenticated,
}: {
  entries: BangumiCardData[];
  authenticated: boolean;
}) {
  const tHome = await getTranslations("home");
  const tNav = await getTranslations("nav");

  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <span className="h-4 w-1 rounded-full bg-primary" />
        <Star className="size-4" />
        {tHome("favorites")}
      </h2>

      {!authenticated ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed px-4 py-6">
          <p className="text-sm text-muted-foreground">{tHome("favoritesLogin")}</p>
          <Link href="/login" className={cn(buttonVariants({ size: "sm" }))}>
            {tNav("login")}
          </Link>
        </div>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{tHome("favoritesEmpty")}</p>
      ) : (
        <BangumiCardGrid entries={entries} />
      )}
    </section>
  );
}
