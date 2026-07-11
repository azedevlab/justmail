"use client";
import * as RxTabs from "@radix-ui/react-tabs";
import type { ReactNode } from "react";
import { cn } from "@justmail/shared-utils";

export function Tabs({
  value,
  onValueChange,
  children,
}: {
  value: string;
  onValueChange: (v: string) => void;
  children: ReactNode;
}) {
  return (
    <RxTabs.Root value={value} onValueChange={onValueChange}>
      {children}
    </RxTabs.Root>
  );
}

export function TabsList({ children }: { children: ReactNode }) {
  return (
    <RxTabs.List className="flex gap-1 border-b border-[var(--color-border)]">
      {children}
    </RxTabs.List>
  );
}

export function TabsTrigger({
  value,
  children,
}: {
  value: string;
  children: ReactNode;
}) {
  return (
    <RxTabs.Trigger
      value={value}
      className={cn(
        "px-3 py-2 text-sm text-[var(--color-neutral-900)]",
        "data-[state=active]:text-[var(--color-neutral-1100)]",
        "data-[state=active]:border-b-2 data-[state=active]:border-[var(--color-accent)]",
        "-mb-px",
      )}
    >
      {children}
    </RxTabs.Trigger>
  );
}

export function TabsContent({
  value,
  children,
}: {
  value: string;
  children: ReactNode;
}) {
  return (
    <RxTabs.Content value={value} className="pt-4">
      {children}
    </RxTabs.Content>
  );
}
