import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrgsModule } from "../orgs/orgs.module";
import { SecurityController } from "./security.controller";
import { SecurityService } from "./security.service";
import { GeoblockService } from "./geoblock.service";

@Module({
  imports: [AuthModule, OrgsModule],
  controllers: [SecurityController],
  providers: [SecurityService, GeoblockService],
})
export class SecurityModule {}
