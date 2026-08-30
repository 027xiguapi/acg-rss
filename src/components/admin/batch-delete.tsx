"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Shared selection state for an admin list table's batch delete. The
 * provider, checkboxes and delete bar are separate components so the
 * server-rendered table rows can stay server components.
 */
interface BatchSelection {
  selected: ReadonlySet<number>;
  toggle: (id: number) => void;
  setSelected: (ids: number[], on: boolean) => void;
  clear: () => void;
}

const BatchSelectionContext = createContext<BatchSelection | null>(null);

export function BatchSelectionProvider({ children }: { children: ReactNode }) {
  const [selected, setSelectedSet] = useState<ReadonlySet<number>>(new Set());

  const value = useMemo<BatchSelection>(
    () => ({
      selected,
      toggle: (id) =>
        setSelectedSet((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        }),
      setSelected: (ids, on) =>
        setSelectedSet((prev) => {
          const next = new Set(prev);
          for (const id of ids) {
            if (on) next.add(id);
            else next.delete(id);
          }
          return next;
        }),
      clear: () => setSelectedSet(new Set()),
    }),
    [selected]
  );

  return (
    <BatchSelectionContext.Provider value={value}>
      {children}
    </BatchSelectionContext.Provider>
  );
}

function useBatchSelection(): BatchSelection {
  const ctx = useContext(BatchSelectionContext);
  if (!ctx) {
    throw new Error("Batch selection components require a provider");
  }
  return ctx;
}

/** Per-row checkbox bound to the shared selection state. */
export function BatchRowCheckbox({
  id,
  disabled,
}: {
  id: number;
  disabled?: boolean;
}) {
  const { selected, toggle } = useBatchSelection();
  return (
    <input
      type="checkbox"
      checked={selected.has(id)}
      disabled={disabled}
      onChange={() => toggle(id)}
      aria-label={`#${id}`}
      className="size-4 cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-30"
    />
  );
}

/** Header checkbox: selects / deselects every row id passed from the page. */
export function BatchSelectAllCheckbox({ ids }: { ids: number[] }) {
  const { selected, setSelected, clear } = useBatchSelection();
  const ref = useRef<HTMLInputElement>(null);

  const allOn = ids.length > 0 && ids.every((id) => selected.has(id));
  const someOn = ids.some((id) => selected.has(id));

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !allOn && someOn;
  }, [allOn, someOn]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={allOn}
      onChange={() => (allOn || someOn ? clear() : setSelected(ids, true))}
      aria-label={String(someOn)}
      className="size-4 cursor-pointer accent-primary"
    />
  );
}

/**
 * Batch delete submit: hidden inputs carry the selected ids to the server
 * action (its own form, so it never nests with row-action forms). Disabled
 * until something is selected; asks for confirmation before submitting.
 */
export function BatchDeleteButton({
  action,
  className,
}: {
  action: (formData: FormData) => Promise<void>;
  className?: string;
}) {
  const { selected, clear } = useBatchSelection();
  const tCommon = useTranslations("common");
  const ids = [...selected];

  return (
    <form
      action={async (formData) => {
        await action(formData);
        clear();
      }}
      onSubmit={(e) => {
        if (!confirm(tCommon("confirmBatchDelete", { count: ids.length }))) {
          e.preventDefault();
        }
      }}
      className={className}
    >
      {ids.map((id) => (
        <input key={id} type="hidden" name="ids" value={id} />
      ))}
      <Button
        type="submit"
        variant="outline"
        size="sm"
        disabled={ids.length === 0}
        className="text-destructive hover:text-destructive"
      >
        <Trash2 className="size-4" />
        {ids.length > 0
          ? tCommon("batchDeleteWithCount", { count: ids.length })
          : tCommon("batchDelete")}
      </Button>
    </form>
  );
}

/** Thin toolbar row shown above a batch-enabled table. */
export function BatchDeleteBar({
  action,
}: {
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <div className={cn("flex items-center justify-end gap-2 px-4 pt-4")}>
      <BatchDeleteButton action={action} />
    </div>
  );
}
