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
      className="w-full bg-[color:rgb(245_158_11/0.12)] text-[var(--color-warn)] text-xs px-4 py-1.5 flex items-center justify-center gap-2 border-b border-[color:rgb(245_158_11/0.25)]"
    >
      <CloudOff size={12} /> You&apos;re offline. Cached data shown.
    </div>
  );
}
