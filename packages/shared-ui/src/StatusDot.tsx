import type { HTMLAttributes } from "react";
import { cn } from "@justmail/shared-utils";

export type DotTone = "ok" | "warn" | "bad" | "info" | "muted";

const toneClass: Record<DotTone, string> = {
  ok: "bg-[var(--color-ok)]",
  warn: "bg-[var(--color-warn)]",
  bad: "bg-[var(--color-bad)]",
  info: "bg-[var(--color-info)]",
  muted: "bg-[var(--color-neutral-700)]",
};

export interface StatusDotProps extends HTMLAttributes<HTMLSpanElement> {
  tone: DotTone;
  pulse?: boolean;
}

export function StatusDot({ tone, pulse, className, ...rest }: StatusDotProps) {
  return (
    <span
      className={cn("relative inline-block w-2 h-2 rounded-full", toneClass[tone], className)}
      {...rest}
    >
      {pulse && (
        <span
          aria-hidden
          className={cn(
            "absolute inset-0 rounded-full opacity-70 animate-ping",
            toneClass[tone],
          )}
        />
      )}
    </span>
  );
}
