import type { ReactNode } from "react";

export interface EmptyProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}

export function Empty({ title, description, action, icon }: EmptyProps) {
  return (
    <div className="border border-dashed border-[var(--color-border)] rounded-xl p-10 text-center bg-transparent">
      {icon && (
        <div className="mx-auto mb-3 w-10 h-10 grid place-items-center text-[var(--color-neutral-700)]">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-medium text-[var(--color-neutral-1100)]">
        {title}
      </h3>
      {description && (
        <p className="text-xs text-[var(--color-neutral-900)] mt-1 max-w-sm mx-auto">
          {description}
        </p>
      )}
      {action && <div className="mt-4 flex items-center justify-center gap-2">{action}</div>}
    </div>
  );
}
