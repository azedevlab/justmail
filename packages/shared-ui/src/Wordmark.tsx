import { cn } from "@justmail/shared-utils";

/** Gradient envelope glyph + product name. */
export function Wordmark({
  size = 32,
  label = "JustMail",
  sub,
  className,
}: {
  size?: number;
  label?: string;
  sub?: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        className="grid place-items-center rounded-[10px] shrink-0"
        style={{
          width: size,
          height: size,
          background:
            "linear-gradient(135deg, var(--color-brand-400) 0%, var(--color-brand-600) 100%)",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.25), 0 2px 8px rgba(92,61,255,0.35)",
        }}
      >
        <svg
          width={size * 0.55}
          height={size * 0.55}
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <rect x="2.5" y="5" width="19" height="14" rx="3" />
          <path d="m3.5 7.5 8.5 6 8.5-6" />
        </svg>
      </span>
      <span className="flex flex-col leading-tight">
        <span className="font-semibold tracking-[-0.02em] text-[var(--color-neutral-1100)]">
          {label}
        </span>
        {sub && (
          <span className="text-[11px] text-[var(--color-neutral-800)]">
            {sub}
          </span>
        )}
      </span>
    </span>
  );
}
