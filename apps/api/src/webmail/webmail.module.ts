import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrgsModule } from "../orgs/orgs.module";
import { AttachmentsModule } from "../attachments/attachments.module";
import { SettingsModule } from "../settings/settings.module";
import { WebmailController } from "./webmail.controller";
import { WebmailService } from "./webmail.service";
import { PersonalizationService } from "./personalization.service";
import { AvatarService } from "./avatar.service";
import { SieveService } from "./sieve.service";

@Module({
  imports: [AuthModule, OrgsModule, AttachmentsModule, SettingsModule],
  controllers: [WebmailController],
  providers: [WebmailService, PersonalizationService, AvatarService, SieveService],
})
export class WebmailModule {}
