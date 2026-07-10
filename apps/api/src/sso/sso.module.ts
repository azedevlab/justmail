import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrgsModule } from "../orgs/orgs.module";
import { SsoAdminController } from "./sso-admin.controller";
import { SsoController } from "./sso.controller";
import { SsoService } from "./sso.service";

@Module({
  imports: [AuthModule, OrgsModule],
  controllers: [SsoController, SsoAdminController],
  providers: [SsoService],
})
export class SsoModule {}
