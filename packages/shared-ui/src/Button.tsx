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
  primary:
    "bg-[var(--color-brand-500)] text-white hover:brightness-110 border border-transparent",
  secondary:
    "bg-transparent text-[var(--color-neutral-1100)] border border-[var(--color-border-strong)] hover:bg-white/5",
  ghost:
    "bg-transparent text-[var(--color-neutral-1100)] border border-transparent hover:bg-white/5",
  danger:
    "bg-transparent text-[var(--color-bad)] border border-[color:rgb(239_68_68_/_0.3)] hover:bg-[color:rgb(239_68_68_/_0.1)]",
  link:
    "bg-transparent text-[var(--color-brand-400)] border-none underline-offset-2 hover:underline p-0",
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
        "inline-flex items-center justify-center font-medium",
        "transition-[background-color,border-color,filter,box-shadow] duration-[var(--motion-quick)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-500)]",
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
