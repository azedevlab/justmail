import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { Db } from "../db/db.service";
import { StorageService } from "../storage/storage.service";
import { SkipThrottle } from "../common/throttle.decorator";

@Controller("healthz")
@SkipThrottle()
export class HealthController {
  constructor(
    private readonly db: Db,
    private readonly storage: StorageService,
  ) {}

  @Get()
  async health() {
    try {
      await this.db.query("SELECT 1");
    } catch {
      throw new ServiceUnavailableException({
        title: "Database unreachable",
      });
    }
    return { status: "ok" };
  }

  // Deep readiness probe: verifies dependencies the app needs to serve traffic
  // (database + configured object storage). Orchestrators point their
  // readinessProbe here; the shallow liveness check above stays cheap.
  @Get("ready")
  async ready() {
    const [dbOk, storage] = await Promise.all([
      this.db
        .query("SELECT 1")
        .then(() => true)
        .catch(() => false),
      this.storage.health(),
    ]);
    if (!dbOk || !storage.ok) {
      throw new ServiceUnavailableException({
        title: "Not ready",
        db: dbOk,
        storage,
      });
    }
    return {
      status: "ok",
      db: true,
      storage: {
        kind: storage.kind,
        latencyMs: storage.latencyMs,
        capabilities: this.storage.capabilities(),
      },
    };
  }
}
