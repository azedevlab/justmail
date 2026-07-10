"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@justmail/shared-utils";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: "sm" | "md" | "lg";
  children: ReactNode;
  footer?: ReactNode;
}

const sizeClass: Record<NonNullable<ModalProps["size"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
};

export function Modal({
  open,
  onClose,
  title,
  description,
  size = "md",
  children,
  footer,
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-[var(--z-modal)] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[var(--z-modal)] w-[calc(100vw-32px)]",
            "bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-[var(--shadow-4)] p-6",
            sizeClass[size],
          )}
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <Dialog.Title className="text-sm font-semibold text-[var(--color-neutral-1100)]">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="text-xs text-[var(--color-neutral-900)] mt-1">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close
              aria-label="Close"
              className="p-1 rounded-md hover:bg-white/5 text-[var(--color-neutral-900)]"
            >
              <X size={16} />
            </Dialog.Close>
          </div>
          {children}
          {footer && (
            <div className="mt-5 pt-4 border-t border-[var(--color-border)] flex items-center justify-end gap-2">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
