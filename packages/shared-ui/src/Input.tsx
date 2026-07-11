"use client";
import {
  forwardRef,
  useState,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@justmail/shared-utils";

const inputClass = cn(
  "w-full rounded-md bg-[var(--color-field)] text-[var(--color-neutral-1100)]",
  "border border-[var(--color-border-strong)] px-3 py-2 text-sm",
  "shadow-[var(--shadow-inset-input)]",
  "placeholder:text-[var(--color-neutral-700)]",
  "transition-[border-color,box-shadow,background] duration-[var(--motion-base)]",
  "hover:border-[var(--color-border-strong)]",
  "focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent-ring)]",
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

export type PasswordInputProps = Omit<InputProps, "type">;

// Password field with an accessible show/hide toggle. Reserves right padding so
// the reveal button never overlaps typed characters.
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ className, invalid, ...rest }, ref) {
    const [visible, setVisible] = useState(false);
    return (
      <div className="relative">
        <input
          ref={ref}
          type={visible ? "text" : "password"}
          aria-invalid={invalid || undefined}
          className={cn(
            inputClass,
            "pr-10",
            invalid && "border-[var(--color-bad)] focus:ring-[var(--color-bad)]",
            className,
          )}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className={cn(
            "absolute right-1 top-1/2 -translate-y-1/2 inline-grid place-items-center",
            "w-8 h-8 rounded-md text-[var(--color-neutral-800)]",
            "transition-colors duration-[var(--motion-base)]",
            "hover:bg-[var(--hover-overlay)] hover:text-[var(--color-neutral-1100)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-ring)]",
          )}
        >
          {visible ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    );
  },
);

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
