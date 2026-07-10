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
    "text-white border border-[color:rgb(0_113_227/0.6)]",
    "bg-[linear-gradient(180deg,var(--color-brand-400),var(--color-brand-600))]",
    "shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_1px_2px_rgba(16,24,40,0.24)]",
    "hover:bg-[linear-gradient(180deg,var(--color-brand-300),var(--color-brand-500))]",
    "active:translate-y-px active:shadow-[inset_0_1px_2px_rgba(0,0,0,0.25)]",
  ),
  secondary: cn(
    "text-[var(--color-neutral-1100)] bg-[var(--color-surface-3)]",
    "border border-[var(--color-border-strong)]",
    "shadow-[var(--shadow-1)]",
    "hover:bg-[var(--color-surface-2)]",
    "active:translate-y-px",
  ),
  ghost: cn(
    "bg-transparent text-[var(--color-neutral-1000)] border border-transparent",
    "hover:bg-[var(--hover-overlay)] hover:text-[var(--color-neutral-1100)]",
  ),
  danger: cn(
    "bg-transparent text-[var(--color-bad)] border border-[color:rgb(239_68_68/0.3)]",
    "hover:bg-[color:rgb(239_68_68/0.1)] hover:border-[color:rgb(239_68_68/0.45)]",
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
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:rgb(10_132_255/0.55)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-bg)]",
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
