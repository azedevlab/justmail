/** Tiny className joiner. Falsy values dropped; no dedup. */
export type ClassValue =
  | string
  | number
  | null
  | undefined
  | false
  | ClassValue[]
  | Record<string, unknown>;

export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];
  for (const value of inputs) {
    if (!value) continue;
    if (typeof value === "string" || typeof value === "number") {
      out.push(String(value));
    } else if (Array.isArray(value)) {
      const inner = cn(...value);
      if (inner) out.push(inner);
    } else if (typeof value === "object") {
      for (const [k, v] of Object.entries(value)) if (v) out.push(k);
    }
  }
  return out.join(" ");
}
