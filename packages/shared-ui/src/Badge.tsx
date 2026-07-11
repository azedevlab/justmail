import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@justmail/shared-utils";

export type BadgeTone =
  | "neutral"
  | "brand"
  | "ok"
  | "warn"
  | "bad"
  | "info"
  | "muted";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  leadingIcon?: ReactNode;
}

const toneClasses: Record<BadgeTone, string> = {
  neutral:
    "bg-[var(--hover-overlay-faint)] text-[var(--color-neutral-1100)] border border-[var(--color-border)]",
  brand:
    "bg-[var(--color-accent-subtle)] text-[var(--color-accent)] border border-[var(--color-accent-border)]",
  ok: "bg-[var(--color-ok-surface)] text-[var(--color-ok)] border border-[var(--color-ok-border)]",
  warn: "bg-[var(--color-warn-surface)] text-[var(--color-warn)] border border-[var(--color-warn-border)]",
  bad: "bg-[var(--color-bad-surface)] text-[var(--color-bad)] border border-[var(--color-bad-border)]",
  info: "bg-[var(--color-info-surface)] text-[var(--color-info)] border border-[var(--color-info-border)]",
  muted:
    "bg-[var(--hover-overlay-faint)] text-[var(--color-neutral-900)] border border-[var(--color-border)]",
};

export function Badge({
  tone = "neutral",
  leadingIcon,
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full",
        "text-[11px] font-medium capitalize tracking-[0.01em] leading-[16px]",
        toneClasses[tone],
        className,
      )}
      {...rest}
    >
      {leadingIcon}
      {children}
    </span>
  );
}
