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
            "min-w-[180px] rounded-xl bg-[var(--color-surface-3)]",
            "border border-[var(--color-border-strong)] shadow-[var(--shadow-3)] p-1",
            "z-[var(--z-modal)] animate-in fade-in-0 zoom-in-95 duration-100",
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
        "flex items-center gap-2 px-2.5 py-1.5 text-sm rounded-lg cursor-pointer",
        "focus:outline-none focus:bg-[var(--hover-overlay)]",
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
    <Rx.Label className="px-2 py-1 text-[11px] font-medium text-[var(--color-neutral-800)]">
      {children}
    </Rx.Label>
  );
}
