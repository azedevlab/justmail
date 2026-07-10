"use client";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@justmail/shared-utils";

export type ToastTone = "info" | "ok" | "warn" | "bad";

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  tone?: ToastTone;
  action?: { label: string; onClick: () => void };
  durationMs?: number;
}

interface ToastContextValue {
  toast: (t: Omit<ToastItem, "id">) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("ToastProvider missing");
  return ctx;
}

const toneClass: Record<ToastTone, string> = {
  info: "border-[var(--color-info)]",
  ok: "border-[var(--color-ok)]",
  warn: "border-[var(--color-warn)]",
  bad: "border-[var(--color-bad)]",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const dismiss = useCallback(
    (id: string) => setItems((prev) => prev.filter((t) => t.id !== id)),
    [],
  );
  const toast = useCallback<ToastContextValue["toast"]>(
    (t) => {
      const id = `t-${Math.random().toString(36).slice(2, 9)}`;
      const item: ToastItem = { id, tone: "info", durationMs: 5000, ...t };
      setItems((prev) => [item, ...prev].slice(0, 3));
      if (item.durationMs && item.durationMs > 0) {
        setTimeout(() => dismiss(id), item.durationMs);
      }
    },
    [dismiss],
  );
  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed bottom-4 right-4 z-[var(--z-toast)] flex flex-col-reverse gap-2 pointer-events-none"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto min-w-[260px] max-w-sm bg-[var(--color-surface)]",
              "border border-l-4 rounded-lg shadow-[var(--shadow-3)] px-4 py-3 text-sm",
              "animate-in fade-in-0 slide-in-from-right-2",
              toneClass[t.tone ?? "info"],
            )}
            role={t.tone === "bad" ? "alert" : "status"}
          >
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <div className="font-medium text-[var(--color-neutral-1100)]">
                  {t.title}
                </div>
                {t.description && (
                  <div className="text-xs text-[var(--color-neutral-900)] mt-0.5">
                    {t.description}
                  </div>
                )}
                {t.action && (
                  <button
                    onClick={() => {
                      t.action!.onClick();
                      dismiss(t.id);
                    }}
                    className="mt-2 text-xs text-[var(--color-brand-400)] hover:underline"
                  >
                    {t.action.label}
                  </button>
                )}
              </div>
              <button
                aria-label="Dismiss"
                onClick={() => dismiss(t.id)}
                className="text-[var(--color-neutral-700)] hover:text-[var(--color-neutral-1100)] p-1 rounded"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
