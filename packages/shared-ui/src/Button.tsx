import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@justmail/shared-utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "link";
export type ButtonSize = "xs" | "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: cn(
    "text-[var(--color-on-accent)] bg-[var(--color-accent)] border border-transparent",
    "shadow-[var(--shadow-btn-primary)]",
    "hover:bg-[var(--color-accent-hover-solid)]",
    "active:translate-y-px active:shadow-[var(--shadow-btn-active)]",
  ),
  secondary: cn(
    "text-[var(--color-neutral-1100)] bg-transparent",
    "border border-[var(--color-border-strong)]",
    "hover:bg-[var(--hover-overlay)]",
    "active:translate-y-px",
  ),
  ghost: cn(
    "bg-transparent text-[var(--color-neutral-1000)] border border-transparent",
    "hover:bg-[var(--hover-overlay)] hover:text-[var(--color-neutral-1100)]",
  ),
  danger: cn(
    "bg-transparent text-[var(--color-bad)] border border-[var(--color-bad-border)]",
    "hover:bg-[var(--color-bad-hover)] hover:border-[var(--color-bad-border)]",
    "active:translate-y-px",
  ),
  link: "bg-transparent text-[var(--color-accent)] border-none underline-offset-2 hover:underline p-0",
};

const sizeClasses: Record<ButtonSize, string> = {
  xs: "text-xs px-2 py-1 rounded-md gap-1",
  sm: "text-sm px-2.5 py-1.5 rounded-md gap-1.5",
  md: "text-sm px-3.5 py-2 rounded-lg gap-2",
  lg: "text-base px-4 py-2.5 rounded-lg gap-2",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "secondary",
    size = "md",
    loading,
    leadingIcon,
    trailingIcon,
    disabled,
    className,
    children,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center font-medium select-none whitespace-nowrap",
        "tracking-[-0.006em]",
        "transition-[background,border-color,box-shadow,transform,color] duration-[var(--motion-base)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-ring)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-bg)]",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...rest}
    >
      {loading ? (
        <span
          className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"
          aria-hidden
        />
      ) : (
        leadingIcon
      )}
      {children}
      {trailingIcon}
    </button>
  );
});
