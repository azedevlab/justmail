import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrgsModule } from "../orgs/orgs.module";
import { DomainsController } from "./domains.controller";
import { BimiController } from "./bimi.controller";
import { DomainsService } from "./domains.service";

@Module({
  imports: [AuthModule, OrgsModule],
  controllers: [DomainsController, BimiController],
  providers: [DomainsService],
  exports: [DomainsService],
})
export class DomainsModule {}
