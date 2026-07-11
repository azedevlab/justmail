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
          background: "var(--gradient-brand-mark)",
          boxShadow: "var(--shadow-brand-mark)",
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
