import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@justmail/shared-utils";

const inputClass = cn(
  "w-full rounded-lg bg-[var(--color-surface)] text-[var(--color-neutral-1100)]",
  "border border-[var(--color-border)] px-3 py-2 text-sm",
  "placeholder:text-[var(--color-neutral-700)]",
  "focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-500)] focus:border-transparent",
  "disabled:opacity-50 disabled:cursor-not-allowed",
  "font-[var(--font-sans)]",
);

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  monospace?: boolean;
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, monospace, invalid, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        inputClass,
        monospace && "font-mono text-xs",
        invalid && "border-[var(--color-bad)] focus:ring-[var(--color-bad)]",
        className,
      )}
      {...rest}
    />
  );
});

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className, invalid, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          inputClass,
          "resize-y min-h-[80px]",
          invalid && "border-[var(--color-bad)] focus:ring-[var(--color-bad)]",
          className,
        )}
        {...rest}
      />
    );
  },
);
