import { cn } from "@justmail/shared-utils";
import { avatarGradients as gradients } from "@justmail/design-tokens";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0]![0] ?? "?").toUpperCase();
  return ((parts[0]![0] ?? "") + (parts[parts.length - 1]![0] ?? "")).toUpperCase();
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return Math.abs(h);
}

export interface AvatarProps {
  name: string;
  size?: number;
  src?: string | null;
  className?: string;
}

export function Avatar({ name, size = 28, src, className }: AvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        className={cn("rounded-full object-cover", className)}
      />
    );
  }
  const bg = gradients[hashCode(name) % gradients.length];
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full text-white font-semibold select-none",
        className,
      )}
      style={{
        width: size,
        height: size,
        background: bg,
        fontSize: size * 0.4,
      }}
      aria-label={name}
    >
      {initials(name)}
    </span>
  );
}
