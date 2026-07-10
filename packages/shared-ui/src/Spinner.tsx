import type { HTMLAttributes } from "react";
import { cn } from "@justmail/shared-utils";

export interface SpinnerProps extends HTMLAttributes<HTMLSpanElement> {
  size?: number;
}

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
        className="inline-block w-full h-full border-2 border-current border-t-transparent rounded-full animate-spin"
        aria-hidden
      />
    </span>
  );
}
