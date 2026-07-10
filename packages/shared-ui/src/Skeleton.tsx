import type { HTMLAttributes } from "react";
import { cn } from "@justmail/shared-utils";

export function Skeleton({
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-busy="true"
      className={cn(
        "animate-pulse rounded-md bg-white/[0.06]",
        className,
      )}
      {...rest}
    />
  );
}

export function SkeletonRows({
  count = 3,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}
