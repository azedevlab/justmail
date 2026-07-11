import type { ReactNode } from "react";
import { cn } from "@justmail/shared-utils";
import { Card } from "./Card.js";

export type StatTone = "neutral" | "ok" | "warn" | "bad" | "brand";

const toneText: Record<StatTone, string> = {
  neutral: "text-[var(--color-neutral-1100)]",
  ok: "text-[var(--color-ok)]",
  warn: "text-[var(--color-warn)]",
  bad: "text-[var(--color-bad)]",
  brand: "text-[var(--color-accent)]",
};

export interface StatProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: StatTone;
  className?: string;
}

export function Stat({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
  className,
}: StatProps) {
  return (
    <Card className={cn("p-4 flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-[var(--color-neutral-800)] font-medium">
          {label}
        </span>
        {icon && (
          <span className="text-[var(--color-neutral-700)]">{icon}</span>
        )}
      </div>
      <div
        className={cn(
          "text-2xl font-semibold tracking-[-0.02em] tabular-nums leading-none",
          toneText[tone],
        )}
      >
        {value}
      </div>
      {hint && (
        <div className="text-xs text-[var(--color-neutral-900)]">{hint}</div>
      )}
    </Card>
  );
}
