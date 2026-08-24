import { getTranslations } from "next-intl/server";
import { Magnet, Search } from "lucide-react";
import type { User } from "@/db/schema";
import { logoutAction } from "@/server/auth/actions";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";

/** Sticky index header: brand, title search, locale/theme switch and auth. */
export async function HomeHeader({
  user,
  query,
}: {
  user: User | null;
  query: string;
}) {
  const tHome = await getTranslations("home");
  const tCommon = await getTranslations("common");
  const tNav = await getTranslations("nav");
  // username is null for OAuth-created accounts
  const displayName = user?.username ?? user?.name ?? user?.email ?? "";

  return (
    <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Magnet className="size-4" />
          </span>
          <span className="hidden sm:inline">{tCommon("appName")}</span>
        </Link>

        <form method="get" className="relative mx-auto w-full max-w-md flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            name="q"
            defaultValue={query}
            placeholder={tHome("searchPlaceholder")}
            aria-label={tCommon("search")}
            className="h-9 pl-8"
          />
        </form>

        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden items-center gap-2 sm:flex">
            <LocaleSwitcher />
            <ThemeToggle />
          </div>
          {user ? (
            <>
              <Link
                href="/bangumi"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "sm" }),
                  "hidden md:inline-flex"
                )}
              >
                {tNav("bangumi")}
              </Link>
              <span
                className="flex size-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold uppercase text-secondary-foreground"
                title={displayName}
              >
                {displayName.slice(0, 1)}
              </span>
              <form action={logoutAction}>
                <Button type="submit" variant="outline" size="sm">
                  {tNav("logout")}
                </Button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
              >
                {tNav("login")}
              </Link>
              <Link href="/register" className={cn(buttonVariants({ size: "sm" }))}>
                {tNav("register")}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
