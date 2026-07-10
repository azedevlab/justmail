import { Injectable, Logger } from "@nestjs/common";
import { connect, type Socket } from "node:net";
import type { Readable } from "node:stream";
import { config } from "../config";

export interface ScanResult {
  clean: boolean;
  signature?: string;
}

/**
 * Minimal clamd INSTREAM client. Streams a message body to clamd over TCP and
 * reports whether it is clean. INSTREAM framing: each chunk is prefixed with a
 * 4-byte big-endian length; a zero-length chunk terminates the stream. clamd
 * replies with `stream: OK` or `stream: <signature> FOUND`.
 */
@Injectable()
export class ClamavService {
  private readonly logger = new Logger(ClamavService.name);

  get enabled(): boolean {
    return config.CLAMAV_ENABLED;
  }

  async scan(source: Readable): Promise<ScanResult> {
    if (!config.CLAMAV_ENABLED) return { clean: true };
    return new Promise<ScanResult>((resolve, reject) => {
      const socket: Socket = connect(config.CLAMAV_PORT, config.CLAMAV_HOST);
      socket.setTimeout(config.CLAMAV_TIMEOUT_MS);
      const chunks: Buffer[] = [];
      let settled = false;

      const fail = (err: Error) => {
        if (settled) return;
        settled = true;
        source.unpipe?.(socket);
        socket.destroy();
        reject(err);
      };

      socket.on("error", fail);
      socket.on("timeout", () => fail(new Error("clamd scan timed out")));
      socket.on("data", (d: Buffer) => chunks.push(d));
      socket.on("end", () => {
        if (settled) return;
        settled = true;
        // clamd null-terminates its reply; drop the NUL before matching.
        const reply = Buffer.concat(chunks).toString("utf8").replace(/\0+$/, "").trim();
        if (/\bOK$/.test(reply)) {
          resolve({ clean: true });
        } else if (/FOUND$/.test(reply)) {
          const signature = reply.replace(/^stream:\s*/, "").replace(/\s+FOUND$/, "");
          resolve({ clean: false, signature });
        } else {
          reject(new Error(`clamd error: ${reply || "empty reply"}`));
        }
      });

      socket.on("connect", () => {
        socket.write("zINSTREAM\0");
        source.on("data", (buf: Buffer) => {
          const header = Buffer.allocUnsafe(4);
          header.writeUInt32BE(buf.length, 0);
          // Backpressure: pause the source if clamd's socket buffer is full.
          const ok = socket.write(Buffer.concat([header, buf]));
          if (!ok) {
            source.pause();
            socket.once("drain", () => source.resume());
          }
        });
        source.on("end", () => {
          const terminator = Buffer.allocUnsafe(4);
          terminator.writeUInt32BE(0, 0);
          socket.write(terminator);
        });
        source.on("error", fail);
      });
    });
  }
}
