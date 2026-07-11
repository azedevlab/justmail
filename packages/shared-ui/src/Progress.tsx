import { cn } from "@justmail/shared-utils";

export function Progress({
  value,
  max = 100,
  className,
  tone = "brand",
}: {
  value: number;
  max?: number;
  className?: string;
  tone?: "brand" | "warn" | "bad";
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const fill =
    tone === "bad"
      ? "bg-[var(--color-bad)]"
      : tone === "warn"
        ? "bg-[var(--color-warn)]"
        : "bg-[var(--color-accent)]";
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={max}
      className={cn(
        "h-1.5 w-full rounded-full bg-[var(--color-surface-2)] overflow-hidden",
        className,
      )}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-300",
          fill,
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
