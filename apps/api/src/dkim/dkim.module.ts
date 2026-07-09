import { Module, OnModuleInit } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrgsModule } from "../orgs/orgs.module";
import { DkimController } from "./dkim.controller";
import { DkimService } from "./dkim.service";
import { DnsService } from "./dns.service";

@Module({
  imports: [AuthModule, OrgsModule],
  controllers: [DkimController],
  providers: [DkimService, DnsService],
  exports: [DkimService, DnsService],
})
export class DkimModule implements OnModuleInit {
  constructor(private readonly dkim: DkimService) {}
  async onModuleInit() {
    // Re-materialise keys on the shared volume in case they were wiped.
    await this.dkim.syncKeysToDisk().catch(() => undefined);
  }
}
