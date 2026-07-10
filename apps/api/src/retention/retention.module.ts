import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrgsModule } from "../orgs/orgs.module";
import { RetentionController } from "./retention.controller";
import { RetentionService } from "./retention.service";
import { LegalHoldService } from "./legal-hold.service";
import { ExportService } from "./export.service";
import { MasterImap } from "./master-imap";

@Module({
  imports: [AuthModule, OrgsModule],
  controllers: [RetentionController],
  providers: [RetentionService, LegalHoldService, ExportService, MasterImap],
  exports: [RetentionService],
})
export class RetentionModule {}
