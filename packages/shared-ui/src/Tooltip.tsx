"use client";
import * as Rx from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";

export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <Rx.Provider delayDuration={300} skipDelayDuration={0}>
      {children}
    </Rx.Provider>
  );
}

export function Tooltip({
  content,
  children,
  side = "bottom",
}: {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <Rx.Root>
      <Rx.Trigger asChild>{children}</Rx.Trigger>
      <Rx.Portal>
        <Rx.Content
          side={side}
          className="rounded-lg bg-[var(--color-surface-3)] border border-[var(--color-border-strong)] px-2 py-1 text-[11px] text-[var(--color-neutral-1000)] shadow-[var(--shadow-3)] z-[var(--z-tooltip)]"
        >
          {content}
          <Rx.Arrow className="fill-[var(--color-surface-3)]" />
        </Rx.Content>
      </Rx.Portal>
    </Rx.Root>
  );
}
