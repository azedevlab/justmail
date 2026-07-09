import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrgsModule } from "../orgs/orgs.module";
import { InvitesController } from "./invites.controller";
import { InvitesService } from "./invites.service";

@Module({
  imports: [AuthModule, OrgsModule],
  controllers: [InvitesController],
  providers: [InvitesService],
})
export class InvitesModule {}
