import type { ReactNode } from "react";
import { cn } from "@justmail/shared-utils";

export interface FormFieldProps {
  label?: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function FormField({
  label,
  hint,
  error,
  htmlFor,
  required,
  children,
  className,
}: FormFieldProps) {
  return (
    <label htmlFor={htmlFor} className={cn("block", className)}>
      {label && (
        <span className="block text-[13px] font-medium text-[var(--color-neutral-1000)] mb-1.5">
          {label}
          {required && (
            <span aria-hidden className="text-[var(--color-bad)] ml-0.5">
              *
            </span>
          )}
        </span>
      )}
      {children}
      {(hint || error) && (
        <span
          className={cn(
            "block text-xs mt-1",
            error ? "text-[var(--color-bad)]" : "text-[var(--color-neutral-900)]",
          )}
        >
          {error ?? hint}
        </span>
      )}
    </label>
  );
}
