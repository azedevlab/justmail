import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@justmail/shared-utils";

export interface IconButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  "aria-label": string;
  size?: "sm" | "md";
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ className, size = "md", ...rest }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          "inline-grid place-items-center rounded-lg text-[var(--color-neutral-900)]",
          "transition-colors duration-[var(--motion-base)]",
          "hover:bg-[var(--hover-overlay)] hover:text-[var(--color-neutral-1100)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:rgb(10_132_255/0.55)]",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          size === "md" ? "w-8 h-8" : "w-7 h-7",
          className,
        )}
        {...rest}
      />
    );
  },
);
