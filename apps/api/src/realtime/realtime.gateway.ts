import { Logger, OnModuleInit } from "@nestjs/common";
import { WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { WebSocket, WebSocketServer as WsServer } from "ws";
import type { IncomingMessage } from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "../config";
import { RealtimeService } from "./realtime.service";

interface AuthedSocket extends WebSocket {
  jm?: {
    sessionId: string;
    userId: string;
    orgIds: string[];
    topics: Set<string>;
    lastPingAt: number;
  };
}

/**
 * WebSocket gateway. Ticket-authenticated at handshake — clients call
 * POST /v1/auth/ws-ticket via REST first, then present the ticket as a
 * query param. Server-authoritative subscriptions: unauthorised topics are
 * silently ignored. Idle sockets are closed after 60 s of silence.
 */
@WebSocketGateway({
  path: "/v1/ws",
  cors: false,
})
export class RealtimeGateway implements OnModuleInit {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: WsServer;

  constructor(private readonly realtime: RealtimeService) {}

  onModuleInit(): void {
    // Wire connection handler once the server is bound by @WebSocketGateway.
    this.server?.on("connection", (raw, req) => {
      const socket = raw as AuthedSocket;
      const parsed = verifyTicket(req);
      if (!parsed) {
        socket.close(1008, "unauthorised");
        return;
      }
      socket.jm = {
        sessionId: parsed.sessionId,
        userId: parsed.userId,
        orgIds: parsed.orgIds,
        topics: new Set(),
        lastPingAt: Date.now(),
      };
      this.realtime.register(socket);
      this.send(socket, {
        op: "hello",
        session_id: parsed.sessionId,
        server_time: new Date().toISOString(),
      });
      socket.on("message", (raw) => this.onMessage(socket, raw.toString()));
      socket.on("close", () => this.realtime.unregister(socket));
    });

    // Idle sweeper.
    setInterval(() => this.sweepIdle(), 20_000).unref();
  }

  private onMessage(socket: AuthedSocket, raw: string) {
    if (!socket.jm) return;
    let msg: { op?: string; topic?: string; at?: number };
    try {
      msg = JSON.parse(raw);
    } catch {
      return this.send(socket, {
        op: "error",
        problem: { title: "Invalid JSON", status: 400 },
      });
    }
    switch (msg.op) {
      case "ping":
        socket.jm.lastPingAt = Date.now();
        return this.send(socket, { op: "pong", at: Date.now() });
      case "subscribe":
        if (!msg.topic || !this.canSubscribe(socket, msg.topic)) return;
        socket.jm.topics.add(msg.topic);
        return;
      case "unsubscribe":
        if (!msg.topic) return;
        socket.jm.topics.delete(msg.topic);
        return;
      default:
        return this.send(socket, {
          op: "error",
          problem: { title: "Unknown op", status: 400 },
        });
    }
  }

  private canSubscribe(socket: AuthedSocket, topic: string): boolean {
    const jm = socket.jm!;
    if (topic.startsWith("org:")) {
      const [, orgId] = topic.split(":");
      return !!orgId && jm.orgIds.includes(orgId);
    }
    if (topic.startsWith(`user:${jm.userId}`)) return true;
    return false;
  }

  private send(socket: AuthedSocket, payload: unknown): void {
    if (socket.readyState !== socket.OPEN) return;
    socket.send(JSON.stringify(payload));
  }

  private sweepIdle(): void {
    const now = Date.now();
    for (const socket of this.realtime.sockets()) {
      const jm = (socket as AuthedSocket).jm;
      if (!jm) continue;
      if (now - jm.lastPingAt > 60_000) {
        socket.close(1013, "idle");
      }
    }
  }
}

interface TicketPayload {
  sessionId: string;
  userId: string;
  orgIds: string[];
  exp: number;
}

function verifyTicket(req: IncomingMessage): TicketPayload | null {
  const url = new URL(req.url ?? "", "http://x");
  const raw = url.searchParams.get("ticket");
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  if (!payloadB64 || !sig) return null;

  const expected = createHmac("sha256", config.ENCRYPTION_KEY)
    .update(payloadB64)
    .digest("base64url");
  if (
    expected.length !== sig.length ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(sig))
  ) {
    return null;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8"),
    ) as TicketPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
