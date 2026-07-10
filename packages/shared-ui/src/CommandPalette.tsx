"use client";
import { Command } from "cmdk";
import { Search } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { cn } from "@justmail/shared-utils";

export interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  keywords?: string[];
  shortcut?: string;
  section?: string;
  icon?: ReactNode;
  perform: () => void;
}

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CommandItem[];
  placeholder?: string;
}

export function CommandPalette({
  open,
  onOpenChange,
  items,
  placeholder = "Type a command or search…",
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);

  const sections = Array.from(
    items.reduce((map, i) => {
      const key = i.section ?? "Actions";
      const list = map.get(key) ?? [];
      list.push(i);
      map.set(key, list);
      return map;
    }, new Map<string, CommandItem[]>()),
  );

  if (!open) return null;

  return (
    <div
      onClick={() => onOpenChange(false)}
      className="fixed inset-0 z-[var(--z-cmdk)] bg-[var(--overlay)] backdrop-blur-[6px] pt-[15vh] px-4 animate-in fade-in-0 duration-100"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="mx-auto max-w-xl animate-in fade-in-0 zoom-in-95 duration-150"
      >
        <Command
          label="Command palette"
          className={cn(
            "rounded-xl border border-[var(--color-border-strong)]",
            "bg-[var(--color-surface-3)] shadow-[var(--shadow-5)] overflow-hidden",
          )}
        >
          <div className="flex items-center gap-2 px-3 border-b border-[var(--color-border)]">
            <Search size={16} className="text-[var(--color-neutral-700)]" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder={placeholder}
              className="w-full bg-transparent outline-none py-3 text-sm text-[var(--color-neutral-1100)] placeholder:text-[var(--color-neutral-700)]"
            />
          </div>
          <Command.List className="max-h-[50vh] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-[var(--color-neutral-900)]">
              No results.
            </Command.Empty>
            {sections.map(([section, group]) => (
              <Command.Group
                key={section}
                heading={section}
                className="text-[10px] uppercase tracking-wider text-[var(--color-neutral-700)] px-2 py-1"
              >
                {group.map((item) => (
                  <Command.Item
                    key={item.id}
                    value={`${item.label} ${(item.keywords ?? []).join(" ")}`}
                    onSelect={() => {
                      item.perform();
                      onOpenChange(false);
                    }}
                    className={cn(
                      "flex items-center justify-between gap-3 px-2 py-2 rounded-md text-sm cursor-pointer",
                      "aria-selected:bg-[color:rgb(124_92_255/0.14)] text-[var(--color-neutral-1100)]",
                    )}
                  >
                    <div className="flex items-center gap-2 flex-1">
                      {item.icon}
                      <div>
                        <div>{item.label}</div>
                        {item.hint && (
                          <div className="text-xs text-[var(--color-neutral-900)]">
                            {item.hint}
                          </div>
                        )}
                      </div>
                    </div>
                    {item.shortcut && (
                      <span className="text-[11px] font-mono text-[var(--color-neutral-700)]">
                        {item.shortcut}
                      </span>
                    )}
                  </Command.Item>
                ))}
              </Command.Group>
            ))}
          </Command.List>
          <div className="flex items-center gap-4 px-3 py-2 border-t border-[var(--color-border)] text-[11px] text-[var(--color-neutral-700)]">
            <span>
              <kbd className="px-1 py-0.5 rounded bg-[var(--hover-overlay)] border border-[var(--color-border)] font-mono">↑↓</kbd>{" "}
              navigate
            </span>
            <span>
              <kbd className="px-1 py-0.5 rounded bg-[var(--hover-overlay)] border border-[var(--color-border)] font-mono">⏎</kbd>{" "}
              select
            </span>
            <span>
              <kbd className="px-1 py-0.5 rounded bg-[var(--hover-overlay)] border border-[var(--color-border)] font-mono">esc</kbd>{" "}
              close
            </span>
          </div>
        </Command>
      </div>
    </div>
  );
}
