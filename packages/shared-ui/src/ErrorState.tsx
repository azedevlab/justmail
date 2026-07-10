import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./Button.js";

export interface ErrorStateProps {
  title?: string;
  description?: string;
  action?: ReactNode;
  onRetry?: () => void;
  traceId?: string;
}

export function ErrorState({
  title = "Something went wrong",
  description,
  action,
  onRetry,
  traceId,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="border border-[color:rgb(239_68_68/0.3)] bg-[color:rgb(239_68_68/0.05)] rounded-xl p-6 text-center"
    >
      <AlertTriangle
        className="mx-auto mb-2 text-[var(--color-bad)]"
        size={20}
      />
      <h3 className="text-sm font-medium text-[var(--color-neutral-1100)]">
        {title}
      </h3>
      {description && (
        <p className="text-xs text-[var(--color-neutral-900)] mt-1 max-w-md mx-auto">
          {description}
        </p>
      )}
      <div className="mt-4 flex items-center justify-center gap-2">
        {action}
        {onRetry && (
          <Button variant="secondary" onClick={onRetry}>
            Retry
          </Button>
        )}
      </div>
      {traceId && (
        <p className="mt-3 text-[10px] font-mono text-[var(--color-neutral-700)]">
          trace: {traceId}
        </p>
      )}
    </div>
  );
}
