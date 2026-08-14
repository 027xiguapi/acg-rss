"use client";

import * as React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "torrent-hub-theme";

/** Tiny external store around localStorage so React reads it cleanly. */
const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function getSnapshot(): Theme {
  return (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "system";
}

function getServerSnapshot(): Theme {
  return "system";
}

export function ThemeToggle() {
  const t = useTranslations("common");
  const theme = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  function apply(next: Theme) {
    localStorage.setItem(STORAGE_KEY, next);
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;
    const dark = next === "dark" || (next === "system" && prefersDark);
    document.documentElement.classList.toggle("dark", dark);
    for (const listener of listeners) listener();
  }

  const cycle: Theme =
    theme === "system" ? "light" : theme === "light" ? "dark" : "system";
  const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => apply(cycle)}
      aria-label={t("theme")}
      title={t(theme)}
    >
      <Icon />
    </Button>
  );
}
