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
          className="rounded-md bg-[var(--color-surface-2)] border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-neutral-1100)] shadow-[var(--shadow-2)] z-[var(--z-tooltip)]"
        >
          {content}
          <Rx.Arrow className="fill-[var(--color-surface-2)]" />
        </Rx.Content>
      </Rx.Portal>
    </Rx.Root>
  );
}
