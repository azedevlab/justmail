import type { HTMLAttributes } from "react";
import { cn } from "@justmail/shared-utils";

const glyph: Record<string, string> = {
  meta: "⌘",
  cmd: "⌘",
  ctrl: "Ctrl",
  control: "Ctrl",
  alt: "⌥",
  option: "⌥",
  shift: "⇧",
  enter: "⏎",
  esc: "Esc",
  escape: "Esc",
  space: "␣",
  up: "↑",
  down: "↓",
  left: "←",
  right: "→",
  backspace: "⌫",
  delete: "⌦",
  tab: "⇥",
};

const render = (key: string) => glyph[key.toLowerCase()] ?? key.toUpperCase();

export interface KeyHintProps extends HTMLAttributes<HTMLElement> {
  combo: string;
}

export function KeyHint({ combo, className, ...rest }: KeyHintProps) {
  const parts = combo.split(/[+\s]/g).filter(Boolean);
  return (
    <kbd
      className={cn(
        "inline-flex items-center gap-0.5 text-[11px] font-mono text-[var(--color-neutral-900)]",
        className,
      )}
      {...rest}
    >
      {parts.map((p, i) => (
        <span
          key={i}
          className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded bg-white/5 border border-[var(--color-border)]"
        >
          {render(p)}
        </span>
      ))}
    </kbd>
  );
}
