"use client";

import * as React from "react";
import { CheckCircle2, CircleAlert, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastVariant = "default" | "success" | "error";

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

const ToastContext = React.createContext<
  (message: string, variant?: ToastVariant) => void
>(() => undefined);

/** Minimal toast stack — call useToast()(message, variant) from anywhere. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const push = React.useCallback(
    (message: string, variant: ToastVariant = "default") => {
      const id = ++toastSeq;
      setToasts((list) => [...list, { id, message, variant }]);
      setTimeout(() => {
        setToasts((list) => list.filter((t) => t.id !== id));
      }, 4000);
    },
    []
  );

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "pointer-events-auto flex items-center gap-2.5 rounded-md border bg-popover px-3.5 py-2.5 text-sm text-popover-foreground shadow-lg",
              toast.variant === "success" && "border-success/40",
              toast.variant === "error" && "border-destructive/40"
            )}
          >
            {toast.variant === "success" ? (
              <CheckCircle2 className="size-4 shrink-0 text-success" />
            ) : toast.variant === "error" ? (
              <CircleAlert className="size-4 shrink-0 text-destructive" />
            ) : (
              <Info className="size-4 shrink-0 text-muted-foreground" />
            )}
            <span className="min-w-0 break-words">{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

let toastSeq = 0;

export function useToast() {
  return React.useContext(ToastContext);
}
