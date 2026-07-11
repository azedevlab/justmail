import type { HTMLAttributes } from "react";
import { cn } from "@justmail/shared-utils";

export interface SpinnerProps extends HTMLAttributes<HTMLSpanElement> {
  size?: number;
}

// Dual-ring: a faint full track under a solid rotating arc, inheriting the
// current text colour so it adapts to any surface without extra props.
export function Spinner({ size = 14, className, ...rest }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn("inline-block", className)}
      style={{ width: size, height: size }}
      {...rest}
    >
      <span
        aria-hidden
        className={cn(
          "block h-full w-full rounded-full animate-spin",
          "border-2 border-[color-mix(in_srgb,currentColor_22%,transparent)]",
          "border-t-current",
        )}
        style={{ borderWidth: Math.max(2, Math.round(size / 9)) }}
      />
    </span>
  );
}
