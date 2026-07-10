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
    "bg-[color:rgb(10_132_255/0.12)] text-[var(--color-accent)] border border-[color:rgb(10_132_255/0.25)]",
  ok: "bg-[color:rgb(34_197_94/0.12)] text-[var(--color-ok)] border border-[color:rgb(34_197_94/0.25)]",
  warn: "bg-[color:rgb(245_158_11/0.12)] text-[var(--color-warn)] border border-[color:rgb(245_158_11/0.25)]",
  bad: "bg-[color:rgb(239_68_68/0.12)] text-[var(--color-bad)] border border-[color:rgb(239_68_68/0.25)]",
  info: "bg-[color:rgb(59_130_246/0.12)] text-[var(--color-info)] border border-[color:rgb(59_130_246/0.25)]",
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
