import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@justmail/shared-utils";

const inputClass = cn(
  "w-full rounded-lg bg-[var(--color-surface-2)] text-[var(--color-neutral-1100)]",
  "border border-[var(--color-border)] px-3 py-2 text-sm",
  "shadow-[inset_0_1px_2px_rgba(0,0,0,0.25)]",
  "placeholder:text-[var(--color-neutral-700)]",
  "transition-[border-color,box-shadow,background] duration-[var(--motion-base)]",
  "hover:border-[var(--color-border-strong)]",
  "focus:outline-none focus:border-[color:rgb(124_92_255/0.6)] focus:ring-[3px] focus:ring-[color:rgb(124_92_255/0.18)]",
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
