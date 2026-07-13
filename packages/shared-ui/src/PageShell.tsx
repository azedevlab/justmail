import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@justmail/shared-utils";

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumbs?: ReactNode;
}) {
  return (
    <header className="px-6 md:px-8 pt-8 pb-2 flex items-start justify-between gap-4 flex-wrap">
      <div>
        {breadcrumbs && <div className="mb-2 text-xs">{breadcrumbs}</div>}
        <h1 className="text-xl font-semibold tracking-[-0.02em] text-[var(--color-neutral-1100)]">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-[var(--color-neutral-900)] mt-1 max-w-2xl">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-wrap">{actions}</div>
      )}
    </header>
  );
}

export function PageBody({
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("p-6 md:p-8 space-y-6 min-h-0", className)}
      {...rest}
    />
  );
}

export function Section({
  title,
  description,
  actions,
  children,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      {(title || actions) && (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && (
              <h2 className="text-sm font-semibold text-[var(--color-neutral-1100)]">
                {title}
              </h2>
            )}
            {description && (
              <p className="text-xs text-[var(--color-neutral-900)] mt-0.5 max-w-2xl leading-relaxed">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
