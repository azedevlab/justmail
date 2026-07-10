import { Badge, type BadgeTone } from "./Badge.js";

const map: Record<string, BadgeTone> = {
  active: "ok",
  ok: "ok",
  pass: "ok",
  pending: "warn",
  pending_verification: "warn",
  verifying: "warn",
  propagating: "warn",
  drifted: "warn",
  warn: "warn",
  running: "warn",
  suspended: "bad",
  disabled: "bad",
  missing: "bad",
  error: "bad",
  failed: "bad",
  bad: "bad",
  unknown: "muted",
  neutral: "neutral",
};

export function StatusBadge({ status }: { status: string }) {
  const tone = map[status.toLowerCase()] ?? "muted";
  return <Badge tone={tone}>{status.replace(/_/g, " ")}</Badge>;
}
