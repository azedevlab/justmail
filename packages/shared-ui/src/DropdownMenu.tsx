"use client";
import * as Rx from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";
import { cn } from "@justmail/shared-utils";

export function DropdownMenu({
  trigger,
  children,
  align = "end",
}: {
  trigger: ReactNode;
  children: ReactNode;
  align?: "start" | "center" | "end";
}) {
  return (
    <Rx.Root>
      <Rx.Trigger asChild>{trigger}</Rx.Trigger>
      <Rx.Portal>
        <Rx.Content
          align={align}
          sideOffset={4}
          className={cn(
            "min-w-[180px] rounded-lg bg-[var(--color-surface-2)]",
            "border border-[var(--color-border)] shadow-[var(--shadow-3)] p-1",
            "z-[var(--z-modal)]",
          )}
        >
          {children}
        </Rx.Content>
      </Rx.Portal>
    </Rx.Root>
  );
}

export function DropdownItem({
  children,
  onSelect,
  destructive,
}: {
  children: ReactNode;
  onSelect?: () => void;
  destructive?: boolean;
}) {
  return (
    <Rx.Item
      onSelect={(e) => {
        e.preventDefault();
        onSelect?.();
      }}
      className={cn(
        "flex items-center gap-2 px-2.5 py-1.5 text-sm rounded-md cursor-pointer",
        "focus:outline-none focus:bg-white/5",
        destructive && "text-[var(--color-bad)]",
      )}
    >
      {children}
    </Rx.Item>
  );
}

export function DropdownSeparator() {
  return <Rx.Separator className="my-1 h-px bg-[var(--color-border)]" />;
}

export function DropdownLabel({ children }: { children: ReactNode }) {
  return (
    <Rx.Label className="px-2 py-1 text-[10px] uppercase tracking-wider text-[var(--color-neutral-900)]">
      {children}
    </Rx.Label>
  );
}
