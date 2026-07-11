"use client";
import {
  forwardRef,
  useState,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { Check, ChevronDown, Eye, EyeOff } from "lucide-react";
import { cn } from "@justmail/shared-utils";

const inputClass = cn(
  "w-full rounded-lg bg-[var(--color-field)] text-[var(--color-neutral-1100)]",
  "border border-[var(--color-border-strong)] px-3 py-2 text-sm",
  "shadow-[var(--shadow-inset-input)]",
  "placeholder:text-[var(--color-neutral-700)]",
  "transition-[border-color,box-shadow,background] duration-[var(--motion-base)]",
  "hover:border-[var(--color-border-strong)]",
  "focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent-ring)]",
  "disabled:bg-[var(--color-surface-2)] disabled:text-[var(--color-neutral-600)] disabled:border-[var(--color-border)] disabled:cursor-not-allowed",
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
            "w-8 h-8 rounded-lg text-[var(--color-neutral-800)]",
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

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

// Styled native <select>: keeps full form/react-hook-form compatibility (works
// with {...register()}) while matching the Input field look, with a chevron
// affordance. The dropdown list itself stays native/OS-rendered.
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, invalid, children, ...rest },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          inputClass,
          "appearance-none pr-9 cursor-pointer",
          invalid && "border-[var(--color-bad)] focus:ring-[var(--color-bad)]",
          className,
        )}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown
        size={15}
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-neutral-800)]"
      />
    </div>
  );
});

const controlBox = cn(
  "peer appearance-none w-[18px] h-[18px] shrink-0 cursor-pointer",
  "border border-[var(--color-border-strong)] bg-[var(--color-field)]",
  "shadow-[var(--shadow-inset-input)]",
  "transition-[background,border-color] duration-[var(--motion-base)]",
  "hover:border-[var(--color-accent)]",
  "checked:bg-[var(--color-accent)] checked:border-[var(--color-accent)]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-ring)]",
  "disabled:opacity-50 disabled:cursor-not-allowed",
);

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

// Custom checkbox that adopts the brand accent when checked. Forwards the ref
// and spreads props to the real <input> so form libraries drive it directly.
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox({ className, ...rest }, ref) {
    return (
      <span className="relative inline-grid place-items-center shrink-0">
        <input
          ref={ref}
          type="checkbox"
          className={cn(controlBox, "rounded-[5px]", className)}
          {...rest}
        />
        <Check
          size={12}
          strokeWidth={3}
          aria-hidden
          className="pointer-events-none absolute text-[var(--color-on-accent)] opacity-0 peer-checked:opacity-100"
        />
      </span>
    );
  },
);

export type RadioProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio(
  { className, ...rest },
  ref,
) {
  return (
    <span className="relative inline-grid place-items-center shrink-0">
      <input
        ref={ref}
        type="radio"
        className={cn(
          controlBox,
          "rounded-full checked:bg-[var(--color-field)] checked:border-[var(--color-accent)]",
          className,
        )}
        {...rest}
      />
      <span className="pointer-events-none absolute w-2 h-2 rounded-full bg-[var(--color-accent)] opacity-0 peer-checked:opacity-100" />
    </span>
  );
});
