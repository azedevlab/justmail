import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { Db } from "../db/db.service";
import { SkipThrottle } from "../common/throttle.decorator";

@Controller("healthz")
@SkipThrottle()
export class HealthController {
  constructor(private readonly db: Db) {}

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
}
