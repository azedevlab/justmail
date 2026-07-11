"use client";
import { CloudOff } from "lucide-react";
import { useOnline } from "@justmail/shared-utils";

export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full bg-[var(--color-warn-surface)] text-[var(--color-warn)] text-xs px-4 py-1.5 flex items-center justify-center gap-2 border-b border-[var(--color-warn-border)]"
    >
      <CloudOff size={12} /> You&apos;re offline. Cached data shown.
    </div>
  );
}
