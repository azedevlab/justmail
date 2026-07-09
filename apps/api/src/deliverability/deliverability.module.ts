import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrgsModule } from "../orgs/orgs.module";
import { DmarcController } from "./dmarc.controller";
import { DmarcService } from "./dmarc.service";

@Module({
  imports: [AuthModule, OrgsModule],
  controllers: [DmarcController],
  providers: [DmarcService],
})
export class DeliverabilityModule {}
