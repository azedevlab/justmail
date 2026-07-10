import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "@justmail/shared-utils";

export function Table({ className, ...rest }: HTMLAttributes<HTMLTableElement>) {
  return (
    <table
      className={cn("w-full text-sm border-collapse", className)}
      {...rest}
    />
  );
}

export function THead({
  className,
  ...rest
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={cn(className)} {...rest}>
      {rest.children}
    </thead>
  );
}

export function TR({
  className,
  ...rest
}: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "border-b border-[var(--color-border)] hover:bg-white/[0.02]",
        className,
      )}
      {...rest}
    />
  );
}

export function TH({
  className,
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "text-left px-3 py-2 text-[11px] uppercase tracking-wider font-medium",
        "text-[var(--color-neutral-900)] bg-transparent sticky top-0",
        className,
      )}
      {...rest}
    />
  );
}

export function TD({
  className,
  ...rest
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn("px-3 py-2.5 align-middle", className)} {...rest} />
  );
}
