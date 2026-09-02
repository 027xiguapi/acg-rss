"use client";

import { useTranslations } from "next-intl";
import { Download, Home, Magnet } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { HeaderSearch } from "@/components/header-search";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { logoutAction } from "@/server/auth/actions";

const PUBLIC_NAV = [
  { href: "/", icon: Home, key: "home" },
  { href: "/torrents", icon: Download, key: "torrents" },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Top-navbar header for public pages: brand, primary nav and account
 * actions (locale / theme / user menu / logout). Split out of AppShell so
 * pages can render it independently of the content column.
 */
export function AppHeader({
  username,
  userId,
}: {
  username: string | null;
  userId: number | null;
}) {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const pathname = usePathname();

  return (
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
            <HeaderSearch />
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
  );
}
