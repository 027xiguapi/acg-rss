"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Search, X } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { FeedOption } from "@/components/rules/rule-form-dialog";

const RESOLUTIONS = ["2160p", "1440p", "1080p", "720p", "480p"] as const;

export function TorrentFilters({
  feeds,
  initial,
}: {
  feeds: FeedOption[];
  initial: { q: string; feed: string; res: string };
}) {
  const t = useTranslations("torrents");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [q, setQ] = React.useState(initial.q);
  const [feed, setFeed] = React.useState(initial.feed);
  const [res, setRes] = React.useState(initial.res);

  function push(next: { q: string; feed: string; res: string }) {
    const params = new URLSearchParams();
    if (next.q) params.set("q", next.q);
    if (next.feed) params.set("feed", next.feed);
    if (next.res) params.set("res", next.res);
    const query = params.toString();
    router.push(query ? `/torrents?${query}` : "/torrents");
  }

  const hasFilters = Boolean(initial.q || initial.feed || initial.res);

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        push({ q, feed, res });
      }}
    >
      <div className="relative min-w-[16rem] flex-1">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="pl-8"
        />
      </div>
      <Select
        aria-label={t("filterFeed")}
        value={feed}
        onChange={(e) => {
          setFeed(e.target.value);
          push({ q, feed: e.target.value, res });
        }}
        className="w-auto"
      >
        <option value="">{t("filterFeed")} · {tCommon("all")}</option>
        {feeds.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </Select>
      <Select
        aria-label={t("filterResolution")}
        value={res}
        onChange={(e) => {
          setRes(e.target.value);
          push({ q, feed, res: e.target.value });
        }}
        className="w-auto"
      >
        <option value="">{t("resolution")} · {tCommon("all")}</option>
        {RESOLUTIONS.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </Select>
      {hasFilters ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={tCommon("cancel")}
          title={tCommon("cancel")}
          onClick={() => {
            setQ("");
            setFeed("");
            setRes("");
            push({ q: "", feed: "", res: "" });
          }}
        >
          <X />
        </Button>
      ) : null}
    </form>
  );
}
