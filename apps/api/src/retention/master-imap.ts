import { Injectable, Logger } from "@nestjs/common";
import { ImapFlow } from "imapflow";
import { config } from "../config";

/**
 * Connects to Dovecot as the configured master user to reach any mailbox
 * without its password. Login uses the `<address>*<master-user>` form with the
 * master password. Used for admin-driven retention pruning and exports; when no
 * master credential is configured the connector reports itself unavailable and
 * callers skip the feature.
 */
@Injectable()
export class MasterImap {
  private readonly logger = new Logger(MasterImap.name);

  get configured(): boolean {
    return Boolean(
      config.DOVECOT_MASTER_USER && config.DOVECOT_MASTER_PASSWORD,
    );
  }

  /** Connect as the master user impersonating `address`, run fn, then log out. */
  async withClient<T>(
    address: string,
    fn: (client: ImapFlow) => Promise<T>,
  ): Promise<T> {
    if (!this.configured) {
      throw new Error("Dovecot master user is not configured");
    }
    const client = new ImapFlow({
      host: config.IMAP_HOST,
      port: config.IMAP_PORT,
      secure: true,
      auth: {
        user: `${address}*${config.DOVECOT_MASTER_USER}`,
        pass: config.DOVECOT_MASTER_PASSWORD!,
      },
      tls: { rejectUnauthorized: config.IMAP_TLS_REJECT_UNAUTHORIZED },
      logger: false,
    });
    client.on("error", (err) =>
      this.logger.warn(`master imap error for ${address}: ${err.message}`),
    );
    await client.connect();
    try {
      return await fn(client);
    } finally {
      try {
        await client.logout();
      } catch {
        client.close();
      }
    }
  }
}
