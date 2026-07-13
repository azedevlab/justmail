import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Pool, PoolClient, PoolConfig, QueryResult, QueryResultRow } from "pg";
import { config } from "../config";

function poolConfig(connectionString: string): PoolConfig {
  return {
    connectionString,
    max: config.DATABASE_POOL_MAX,
    idleTimeoutMillis: config.DATABASE_POOL_IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: config.DATABASE_CONNECT_TIMEOUT_MS,
    ssl: config.DATABASE_SSL
      ? { rejectUnauthorized: config.DATABASE_SSL_REJECT_UNAUTHORIZED }
      : undefined,
  };
}

@Injectable()
export class Db implements OnModuleDestroy {
  readonly pool = new Pool(poolConfig(config.DATABASE_URL));
  // Reads go to the replica when DATABASE_READONLY_URL is set; otherwise this is
  // the same primary pool so callers can use queryRead unconditionally.
  readonly readPool = config.DATABASE_READONLY_URL
    ? new Pool(poolConfig(config.DATABASE_READONLY_URL))
    : this.pool;

  query<R extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<R>> {
    return this.pool.query<R>(text, params as never[]);
  }

  /** Route a read-only query to the replica pool (falls back to primary). */
  queryRead<R extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<R>> {
    return this.readPool.query<R>(text, params as never[]);
  }

  async tx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
    if (this.readPool !== this.pool) await this.readPool.end();
  }
}
