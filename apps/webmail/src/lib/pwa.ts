"use client";
import { api } from "./api";

// Register the service worker that powers offline read and push. Safe to call
// on every mount; the browser deduplicates repeat registrations.
export function registerServiceWorker(): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js").catch(() => {
    // Registration failures are non-fatal — the app works without offline/push.
  });
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

// The applicationServerKey must be a Uint8Array; the API returns the VAPID
// public key as a URL-safe base64 string.
function urlBase64ToArrayBuffer(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buffer;
}

export type PushEnableResult = "enabled" | "denied" | "unsupported" | "unconfigured";

// Request permission and register a browser push subscription with the API.
// Idempotent: re-subscribing simply refreshes the stored keys server-side.
export async function enablePush(): Promise<PushEnableResult> {
  if (!pushSupported()) return "unsupported";

  const { key } = await api.get<{ key: string | null }>(
    "/v1/notifications/web-push/key",
  );
  if (!key) return "unconfigured";

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";

  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToArrayBuffer(key),
    }));

  const json = sub.toJSON();
  await api.post("/v1/notifications/web-push/subscribe", {
    endpoint: sub.endpoint,
    keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
    user_agent: navigator.userAgent,
  });
  return "enabled";
}

export async function pushEnabled(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== "granted") return false;
  const reg = await navigator.serviceWorker.ready;
  return (await reg.pushManager.getSubscription()) !== null;
}
