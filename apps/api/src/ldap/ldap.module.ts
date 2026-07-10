import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrgsModule } from "../orgs/orgs.module";
import { LdapController } from "./ldap.controller";
import { LdapService } from "./ldap.service";

@Module({
  imports: [AuthModule, OrgsModule],
  controllers: [LdapController],
  providers: [LdapService],
  exports: [LdapService],
})
export class LdapModule {}
