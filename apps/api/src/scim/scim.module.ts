import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrgsModule } from "../orgs/orgs.module";
import { ScimAdminController } from "./scim-admin.controller";
import { ScimController } from "./scim.controller";
import { ScimGuard } from "./scim.guard";
import { ScimService } from "./scim.service";

@Module({
  imports: [AuthModule, OrgsModule],
  controllers: [ScimController, ScimAdminController],
  providers: [ScimService, ScimGuard],
})
export class ScimModule {}
