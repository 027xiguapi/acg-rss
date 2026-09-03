"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link2, Loader2 } from "lucide-react";
import {
  linkTorrentToBangumiAction,
  searchBangumiAction,
  type BangumiSearchResult,
} from "@/server/torrents/actions";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/toast";
import { cn } from "@/lib/utils";

/**
 * Searchable dropdown that links an unlinked torrent to a tracked bangumi.
 * The results list is portaled to <body> so it isn't clipped by the table's
 * `overflow-auto` wrapper; it is positioned under the trigger button.
 */
export function BangumiLinkCombobox({ torrentId }: { torrentId: number }) {
  const t = useTranslations("torrents");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const toast = useToast();

  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [options, setOptions] = React.useState<BangumiSearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [linking, setLinking] = React.useState(false);
  const [pos, setPos] = React.useState({ top: 0, left: 0, width: 260 });

  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  // Position the floating panel under the trigger whenever it opens.
  React.useEffect(() => {
    if (!open) return;
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.max(rect.width, 260);
    setPos({
      top: rect.bottom + 4,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
      width,
    });
  }, [open]);

  // Debounced search; runs once on open so the dropdown isn't blank.
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const results = await searchBangumiAction(query);
      if (!cancelled) {
        setOptions(results);
        setLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, query]);

  function openPanel() {
    setOpen(true);
    setLoading(true);
  }

  // Close on outside click or Escape.
  React.useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (panelRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function select(bangumiId: number) {
    setLinking(true);
    const result = await linkTorrentToBangumiAction(torrentId, bangumiId);
    setLinking(false);
    setOpen(false);
    if (result?.ok) {
      toast(tCommon("saved"), "success");
      router.refresh();
    } else {
      toast(tCommon("error"), "error");
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openPanel())}
        className="inline-flex items-center gap-1 rounded-md border border-dashed border-input px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
      >
        <Link2 className="size-3.5" />
        {t("linkBangumi")}
      </button>

      {open
        ? createPortal(
            <div
              ref={panelRef}
              style={{ top: pos.top, left: pos.left, width: pos.width }}
              className="fixed z-50 flex max-h-80 flex-col rounded-md border bg-card text-card-foreground shadow-lg"
            >
              <div className="border-b p-2">
                <Input
                  autoFocus
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setLoading(true);
                  }}
                  placeholder={t("searchBangumiPlaceholder")}
                  className="h-8"
                />
              </div>
              <ul className="flex-1 overflow-y-auto p-1">
                {loading ? (
                  <li className="flex items-center justify-center gap-2 px-2 py-3 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    {tCommon("loading")}
                  </li>
                ) : options.length === 0 ? (
                  <li className="px-2 py-3 text-center text-sm text-muted-foreground">
                    {tCommon("noResults")}
                  </li>
                ) : (
                  options.map((option) => (
                    <li key={option.id}>
                      <button
                        type="button"
                        disabled={linking}
                        onClick={() => select(option.id)}
                        className={cn(
                          "block w-full truncate rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                          "disabled:cursor-not-allowed disabled:opacity-50"
                        )}
                        title={option.title}
                      >
                        {option.title}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
