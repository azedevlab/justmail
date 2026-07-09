import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-4 px-8 py-6 border-b border-white/5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="text-sm text-[var(--color-ink-300)] mt-1">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}

export function PageBody({ children }: { children: ReactNode }) {
  return <div className="p-8 space-y-6">{children}</div>;
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="card p-5">
      <div className="text-xs uppercase tracking-wider text-[var(--color-ink-400)]">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      {hint && (
        <div className="mt-1 text-xs text-[var(--color-ink-300)]">{hint}</div>
      )}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "active" || status === "ok"
      ? "badge-ok"
      : status === "pending" ||
        status === "pending_verification" ||
        status === "verifying" ||
        status === "propagating" ||
        status === "drifted"
      ? "badge-warn"
      : status === "suspended" ||
        status === "missing" ||
        status === "error" ||
        status === "disabled"
      ? "badge-bad"
      : "badge-muted";
  return <span className={`badge ${tone}`}>{status.replace(/_/g, " ")}</span>;
}

export function EmptyState({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="card p-12 text-center">
      <p className="text-[var(--color-ink-300)]">{title}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
