"use client";
import { useEffect, useRef } from "react";
import { api, API_BASE } from "./api";

const WS_BASE = API_BASE.replace(/^http/, "ws");

type MailEvent = { type: string; data: Record<string, unknown> };

/**
 * Subscribes to the session's realtime topic and arms server-side IMAP IDLE
 * for the open folder. Invokes `onChange` for mail:new/flags/expunge events
 * scoped to this mailbox+folder. Reconnects on drop and re-arms the watcher on
 * a timer so an orphaned server watcher is never left running for long.
 */
export function useMailboxRealtime(opts: {
  orgId: string | undefined;
  mailboxId: string;
  folder: string;
  enabled: boolean;
  onChange: (event: MailEvent) => void;
}): void {
  const { orgId, mailboxId, folder, enabled } = opts;
  const onChange = useRef(opts.onChange);
  onChange.current = opts.onChange;

  useEffect(() => {
    if (!orgId || !mailboxId || !enabled) return;
    let closed = false;
    let ws: WebSocket | null = null;
    let pingTimer: ReturnType<typeof setInterval> | undefined;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    const base = `/v1/orgs/${orgId}/webmail/mailboxes/${mailboxId}`;
    const arm = () =>
      api
        .post(`${base}/folders/${encodeURIComponent(folder)}/watch`)
        .catch(() => undefined);

    const connect = async () => {
      let ticket: string;
      try {
        ({ ticket } = await api.post<{ ticket: string }>("/v1/auth/ws-ticket"));
      } catch {
        if (!closed) reconnectTimer = setTimeout(connect, 5000);
        return;
      }
      if (closed) return;
      const socket = new WebSocket(
        `${WS_BASE}/v1/ws?ticket=${encodeURIComponent(ticket)}`,
      );
      ws = socket;
      socket.onmessage = (ev) => {
        let msg: {
          op?: string;
          session_id?: string;
          event?: MailEvent;
        };
        try {
          msg = JSON.parse(ev.data as string);
        } catch {
          return;
        }
        if (msg.op === "hello" && msg.session_id) {
          socket.send(
            JSON.stringify({ op: "subscribe", topic: `session:${msg.session_id}` }),
          );
          void arm();
        } else if (msg.op === "event" && msg.event) {
          const d = msg.event.data;
          if (d?.mailbox_id === mailboxId && d?.folder === folder) {
            onChange.current(msg.event);
          }
        }
      };
      socket.onclose = () => {
        if (!closed) reconnectTimer = setTimeout(connect, 3000);
      };
      socket.onerror = () => socket.close();
      pingTimer = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ op: "ping" }));
        }
      }, 25_000);
    };

    void connect();
    const rearmTimer = setInterval(arm, 240_000);

    return () => {
      closed = true;
      clearInterval(rearmTimer);
      if (pingTimer) clearInterval(pingTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      api.post(`${base}/unwatch`).catch(() => undefined);
      ws?.close();
    };
  }, [orgId, mailboxId, folder, enabled]);
}
