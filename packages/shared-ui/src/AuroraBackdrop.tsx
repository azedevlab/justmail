import { cn } from "@justmail/shared-utils";

/**
 * Full-viewport decorative backdrop for auth and hero surfaces: two soft
 * radial brand glows over a masked dot grid. Purely presentational.
 */
export function AuroraBackdrop({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className,
      )}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(var(--dot-grid) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          maskImage:
            "radial-gradient(ellipse 80% 60% at 50% 35%, black 30%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 60% at 50% 35%, black 30%, transparent 75%)",
        }}
      />
      <div
        className="absolute -top-[20%] left-[15%] w-[45vw] h-[45vw] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(124,92,255,0.12) 0%, transparent 65%)",
          filter: "blur(40px)",
        }}
      />
      <div
        className="absolute -top-[10%] right-[10%] w-[38vw] h-[38vw] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 65%)",
          filter: "blur(48px)",
        }}
      />
    </div>
  );
}
