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
          "inline-grid place-items-center select-none rounded-lg text-[var(--color-neutral-900)]",
          "transition-[background,color,transform] duration-[var(--motion-base)]",
          "hover:bg-[var(--hover-overlay)] hover:text-[var(--color-neutral-1100)]",
          "active:translate-y-px",
          "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--color-accent-focus)]",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:translate-y-0",
          size === "md" ? "w-8 h-8" : "w-7 h-7",
          className,
        )}
        {...rest}
      />
    );
  },
);
