import { Injectable, Logger } from "@nestjs/common";
import type { WebSocket } from "ws";

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
 * In-process registry + publisher. Keeps a set of live sockets and fans out
 * events to subscribers whose topic filter matches. Fan-out is O(n) in the
 * number of open sockets — fine for single-node; cluster tier moves to
 * Redis pub/sub in v1.1.
 */
@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private readonly _sockets = new Set<AuthedSocket>();

  register(socket: AuthedSocket): void {
    this._sockets.add(socket);
  }

  unregister(socket: AuthedSocket): void {
    this._sockets.delete(socket);
  }

  sockets(): Iterable<AuthedSocket> {
    return this._sockets;
  }

  /**
   * Publish an event on a topic. `orgIds` restricts delivery — only sockets
   * whose principal.orgIds intersects will receive.
   */
  publish(
    topic: string,
    orgIds: string[],
    event: { type: string; data: unknown },
  ): void {
    const payload = JSON.stringify({
      op: "event",
      topic,
      event: {
        ...event,
        at: new Date().toISOString(),
      },
    });
    for (const socket of this._sockets) {
      if (socket.readyState !== socket.OPEN) continue;
      const jm = socket.jm;
      if (!jm) continue;
      if (!jm.topics.has(topic)) continue;
      if (orgIds.length && !orgIds.some((o) => jm.orgIds.includes(o))) continue;
      try {
        socket.send(payload);
      } catch (err) {
        this.logger.warn(`ws publish failed: ${(err as Error).message}`);
      }
    }
  }
}
