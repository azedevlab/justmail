import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrgsModule } from "../orgs/orgs.module";
import { SettingsModule } from "../settings/settings.module";
import { AttachmentsController } from "./attachments.controller";
import { AttachmentsService } from "./attachments.service";
import { ThumbnailService } from "./thumbnail.service";

@Module({
  imports: [AuthModule, OrgsModule, SettingsModule],
  controllers: [AttachmentsController],
  providers: [AttachmentsService, ThumbnailService],
  exports: [AttachmentsService, ThumbnailService],
})
export class AttachmentsModule {}
