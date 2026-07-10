import net from "node:net";
import tls from "node:tls";

// A minimal ManageSieve (RFC 5804) client: enough to authenticate over
// STARTTLS and manage a single per-user script (PUTSCRIPT / SETACTIVE /
// DELETESCRIPT / LISTSCRIPTS / GETSCRIPT). Commands are strictly serialized.

export interface ManageSieveOptions {
  host: string;
  port: number;
  rejectUnauthorized: boolean;
  connectTimeoutMs?: number;
}

// Quote a ManageSieve string literal (RFC 5804 §1.6): backslash and quote escape.
function quote(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

interface Response {
  status: "OK" | "NO" | "BYE";
  response: string;
  lines: string[];
}

export class ManageSieveClient {
  private socket: net.Socket | tls.TLSSocket;
  private buffer = Buffer.alloc(0);
  private wake: (() => void) | null = null;
  private failure: Error | null = null;

  private constructor(socket: net.Socket) {
    this.socket = socket;
    this.attach(socket);
  }

  static connect(opts: ManageSieveOptions): Promise<ManageSieveClient> {
    return new Promise((resolve, reject) => {
      const socket = net.connect({ host: opts.host, port: opts.port });
      const timeout = opts.connectTimeoutMs ?? 15_000;
      socket.setTimeout(timeout);
      const onError = (err: Error) => {
        socket.destroy();
        reject(err);
      };
      socket.once("error", onError);
      socket.once("timeout", () => onError(new Error("ManageSieve connect timeout")));
      socket.once("connect", () => {
        socket.setTimeout(0);
        socket.removeListener("error", onError);
        const client = new ManageSieveClient(socket);
        // Consume the initial capability greeting.
        client.readResponse().then(
          () => resolve(client),
          (err) => {
            client.close();
            reject(err);
          },
        );
      });
    });
  }

  private attach(socket: net.Socket | tls.TLSSocket): void {
    this.socket = socket;
    this.buffer = Buffer.alloc(0);
    socket.on("data", (chunk: Buffer) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this.signal();
    });
    socket.on("error", (err: Error) => {
      this.failure = err;
      this.signal();
    });
    socket.on("close", () => {
      this.failure ??= new Error("ManageSieve connection closed");
      this.signal();
    });
  }

  private signal(): void {
    if (this.wake) {
      const w = this.wake;
      this.wake = null;
      w();
    }
  }

  private waitData(): Promise<void> {
    if (this.failure) return Promise.reject(this.failure);
    return new Promise((resolve) => {
      this.wake = resolve;
    });
  }

  private async readExact(n: number): Promise<Buffer> {
    while (this.buffer.length < n) {
      if (this.failure) throw this.failure;
      await this.waitData();
    }
    const out = this.buffer.subarray(0, n);
    this.buffer = this.buffer.subarray(n);
    return out;
  }

  private async readLineRaw(): Promise<string> {
    while (true) {
      const idx = this.buffer.indexOf("\r\n");
      if (idx >= 0) {
        const line = this.buffer.subarray(0, idx).toString("utf8");
        this.buffer = this.buffer.subarray(idx + 2);
        return line;
      }
      if (this.failure) throw this.failure;
      await this.waitData();
    }
  }

  // Read one logical line, inlining any {n} literal payloads it contains.
  private async readLogicalLine(): Promise<string> {
    let result = "";
    while (true) {
      const line = await this.readLineRaw();
      const m = line.match(/\{(\d+)\+?\}$/);
      if (!m) return result + line;
      const n = Number(m[1]);
      const lit = await this.readExact(n);
      result += line.slice(0, line.length - m[0].length) + lit.toString("utf8");
    }
  }

  private async readResponse(): Promise<Response> {
    const lines: string[] = [];
    while (true) {
      const line = await this.readLogicalLine();
      const upper = line.toUpperCase();
      if (upper.startsWith("OK")) return { status: "OK", response: line, lines };
      if (upper.startsWith("NO")) return { status: "NO", response: line, lines };
      if (upper.startsWith("BYE")) return { status: "BYE", response: line, lines };
      lines.push(line);
    }
  }

  private write(text: string): void {
    this.socket.write(text);
  }

  private async command(line: string): Promise<Response> {
    this.write(`${line}\r\n`);
    const res = await this.readResponse();
    if (res.status !== "OK") {
      throw new Error(`ManageSieve command failed: ${res.response}`);
    }
    return res;
  }

  async startTls(rejectUnauthorized: boolean): Promise<void> {
    await this.command("STARTTLS");
    const host = (this.socket as net.Socket).remoteAddress;
    const tlsSocket = tls.connect({
      socket: this.socket,
      servername: typeof host === "string" ? host : undefined,
      rejectUnauthorized,
    });
    await new Promise<void>((resolve, reject) => {
      tlsSocket.once("secureConnect", resolve);
      tlsSocket.once("error", reject);
    });
    this.failure = null;
    this.attach(tlsSocket);
    // Servers re-issue the capability greeting after the TLS upgrade.
    await this.readResponse();
  }

  async authenticate(user: string, pass: string): Promise<void> {
    const initial = Buffer.from(`\0${user}\0${pass}`, "utf8").toString("base64");
    await this.command(`AUTHENTICATE "PLAIN" ${quote(initial)}`);
  }

  // Upload a script under `name` using a synchronizing literal.
  async putScript(name: string, body: string): Promise<void> {
    const payload = Buffer.from(body, "utf8");
    this.write(`PUTSCRIPT ${quote(name)} {${payload.length}}\r\n`);
    const cont = await this.readLogicalLine();
    if (!cont.startsWith("+")) {
      throw new Error(`ManageSieve PUTSCRIPT rejected: ${cont}`);
    }
    this.socket.write(payload);
    this.write("\r\n");
    const res = await this.readResponse();
    if (res.status !== "OK") {
      throw new Error(`ManageSieve PUTSCRIPT failed: ${res.response}`);
    }
  }

  async setActive(name: string): Promise<void> {
    await this.command(`SETACTIVE ${quote(name)}`);
  }

  async deleteScript(name: string): Promise<void> {
    await this.command(`DELETESCRIPT ${quote(name)}`);
  }

  async listScripts(): Promise<{ name: string; active: boolean }[]> {
    const res = await this.command("LISTSCRIPTS");
    return res.lines.map((line) => {
      const active = / ACTIVE\s*$/i.test(line);
      const name = line.replace(/ ACTIVE\s*$/i, "").trim().replace(/^"|"$/g, "");
      return { name, active };
    });
  }

  async logout(): Promise<void> {
    try {
      this.write("LOGOUT\r\n");
      await this.readResponse();
    } catch {
      // Best-effort; the socket is closed regardless.
    }
    this.close();
  }

  close(): void {
    this.socket.destroy();
  }
}
