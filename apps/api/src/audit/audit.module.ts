import { Global, Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrgsModule } from "../orgs/orgs.module";
import { AuditController } from "./audit.controller";
import { AuditService } from "./audit.service";

@Global()
@Module({
  imports: [AuthModule, OrgsModule],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
