import type { ReactNode } from "react";

export interface EmptyProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}

export function Empty({ title, description, action, icon }: EmptyProps) {
  return (
    <div className="rounded-2xl p-12 text-center bg-[var(--color-surface-1)] border border-[var(--color-border)] shadow-[var(--shadow-1)]">
      {icon && (
        <div className="mx-auto mb-4 w-12 h-12 grid place-items-center rounded-xl bg-[color:rgb(10_132_255/0.10)] text-[var(--color-accent)]">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-semibold text-[var(--color-neutral-1100)]">
        {title}
      </h3>
      {description && (
        <p className="text-[13px] text-[var(--color-neutral-900)] mt-1.5 max-w-sm mx-auto leading-relaxed">
          {description}
        </p>
      )}
      {action && (
        <div className="mt-5 flex items-center justify-center gap-2">
          {action}
        </div>
      )}
    </div>
  );
}
