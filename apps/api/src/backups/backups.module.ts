import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrgsModule } from "../orgs/orgs.module";
import { BackupsController } from "./backups.controller";
import { BackupsService } from "./backups.service";
import { BackupEngine } from "./backup-engine.service";

@Module({
  imports: [AuthModule, OrgsModule],
  controllers: [BackupsController],
  providers: [BackupsService, BackupEngine],
  exports: [BackupEngine],
})
export class BackupsModule {}
