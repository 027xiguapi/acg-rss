"use client";

import { useTranslations } from "next-intl";
import { Download, Magnet, Tv } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";

import { logoutAction } from "@/server/auth/actions";

const PUBLIC_NAV = [
  { href: "/bangumi", icon: Tv, key: "bangumi" },
  { href: "/torrents", icon: Download, key: "torrents" },
] as const;

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Top-navbar shell for all public pages: brand / nav / account actions. */
export function AppShell({
  username,
  userId,
  children,
}: {
  username: string | null;
  userId: number | null;
  children: React.ReactNode;
}) {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Magnet className="size-4" />
            </span>
            <span className="hidden sm:inline">{tCommon("appName")}</span>
          </Link>

          <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
            {PUBLIC_NAV.map(({ href, icon: Icon, key }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive(pathname, href)
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="size-4" />
                {t(key)}
              </Link>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <LocaleSwitcher />
            <ThemeToggle />
            {username && userId != null ? (
              <>
                <Link
                  href={`/user/${userId}`}
                  className="hidden items-center gap-2 text-sm font-medium transition-colors hover:text-primary md:flex"
                  title={username}
                >
                  <span className="flex size-7 items-center justify-center rounded-full bg-secondary text-xs font-semibold uppercase text-secondary-foreground">
                    {username.slice(0, 1)}
                  </span>
                  <span className="max-w-32 truncate">{username}</span>
                </Link>
                <form action={logoutAction}>
                  <Button type="submit" variant="outline" size="sm">
                    {t("logout")}
                  </Button>
                </form>
              </>
            ) : (
              <Link href="/login" className={cn(buttonVariants({ size: "sm" }))}>
                {t("login")}
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
