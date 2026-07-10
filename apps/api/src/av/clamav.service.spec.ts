import { afterEach, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:net";
import { Readable } from "node:stream";
import { config } from "../config";
import { ClamavService } from "./clamav.service";

// Minimal fake clamd: parses INSTREAM framing, reconstructs the payload, and
// replies FOUND if it contains the EICAR marker, otherwise OK.
function startFakeClamd(): Promise<Server> {
  const server = createServer((socket) => {
    const chunks: Buffer[] = [];
    let replied = false;
    socket.on("data", (d) => {
      chunks.push(d);
      const buf = Buffer.concat(chunks);
      // Strip the leading "zINSTREAM\0" command, then walk length-prefixed
      // frames until the zero-length terminator arrives.
      const nul = buf.indexOf(0);
      if (nul < 0) return;
      let offset = nul + 1;
      const payload: Buffer[] = [];
      let terminated = false;
      while (offset + 4 <= buf.length) {
        const len = buf.readUInt32BE(offset);
        offset += 4;
        if (len === 0) {
          terminated = true;
          break;
        }
        if (offset + len > buf.length) break;
        payload.push(buf.subarray(offset, offset + len));
        offset += len;
      }
      if (!terminated || replied) return;
      replied = true;
      const body = Buffer.concat(payload).toString("utf8");
      const reply = body.includes("EICAR")
        ? "stream: Eicar-Test-Signature FOUND\0"
        : "stream: OK\0";
      socket.end(reply);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

describe("ClamavService", () => {
  let server: Server | undefined;
  const original = { host: config.CLAMAV_HOST, port: config.CLAMAV_PORT };

  afterEach(() => {
    server?.close();
    server = undefined;
    config.CLAMAV_HOST = original.host;
    config.CLAMAV_PORT = original.port;
    config.CLAMAV_ENABLED = true;
  });

  it("reports a clean body", async () => {
    server = await startFakeClamd();
    const addr = server.address();
    config.CLAMAV_HOST = "127.0.0.1";
    config.CLAMAV_PORT = typeof addr === "object" && addr ? addr.port : 0;
    const svc = new ClamavService();
    const result = await svc.scan(Readable.from([Buffer.from("hello world")]));
    expect(result).toEqual({ clean: true });
  });

  it("flags an EICAR body as infected with its signature", async () => {
    server = await startFakeClamd();
    const addr = server.address();
    config.CLAMAV_HOST = "127.0.0.1";
    config.CLAMAV_PORT = typeof addr === "object" && addr ? addr.port : 0;
    const svc = new ClamavService();
    const result = await svc.scan(
      Readable.from([Buffer.from("X5O!P%@AP EICAR test")]),
    );
    expect(result.clean).toBe(false);
    expect(result.signature).toBe("Eicar-Test-Signature");
  });

  it("short-circuits to clean when disabled", async () => {
    config.CLAMAV_ENABLED = false;
    const svc = new ClamavService();
    const result = await svc.scan(Readable.from([Buffer.from("anything")]));
    expect(result).toEqual({ clean: true });
  });
});
