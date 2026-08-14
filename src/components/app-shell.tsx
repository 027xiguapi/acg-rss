"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  Download,
  LayoutDashboard,
  Magnet,
  Menu,
  Rss,
  Settings,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { logoutAction } from "@/server/auth/actions";

const NAV_ITEMS = [
  { href: "/dashboard", icon: LayoutDashboard, key: "dashboard" },
  { href: "/feeds", icon: Rss, key: "feeds" },
  { href: "/torrents", icon: Magnet, key: "torrents" },
  { href: "/rules", icon: SlidersHorizontal, key: "rules" },
  { href: "/downloads", icon: Download, key: "downloads" },
  { href: "/settings", icon: Settings, key: "settings" },
] as const;

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({
  username,
  children,
}: {
  username: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const nav = (
    <nav className="flex flex-col gap-1 px-3">
      {NAV_ITEMS.map(({ href, icon: Icon, key }) => (
        <Link
          key={href}
          href={href}
          onClick={() => setMobileOpen(false)}
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
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
  );

  const sidebarInner = (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2 border-b px-5 font-semibold">
        <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Magnet className="size-4" />
        </span>
        {tCommon("appName")}
      </div>
      <div className="flex-1 overflow-y-auto py-3">{nav}</div>
      <div className="border-t p-3">
        <div className="flex items-center justify-between gap-2 px-2 pb-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold uppercase text-secondary-foreground">
              {username.slice(0, 1)}
            </span>
            <span className="truncate text-sm font-medium">{username}</span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
        <form action={logoutAction} className="mt-3">
          <Button type="submit" variant="outline" size="sm" className="w-full">
            {t("logout")}
          </Button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r bg-card md:block">
        {sidebarInner}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="fixed inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 w-64 border-r bg-card">
            {sidebarInner}
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col md:pl-60">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur md:hidden">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Menu"
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X /> : <Menu />}
          </Button>
          <span className="flex items-center gap-2 font-semibold">
            <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Magnet className="size-3.5" />
            </span>
            {tCommon("appName")}
          </span>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
