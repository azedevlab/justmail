import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrgsModule } from "../orgs/orgs.module";
import { AttachmentsModule } from "../attachments/attachments.module";
import { WebmailController } from "./webmail.controller";
import { WebmailService } from "./webmail.service";

@Module({
  imports: [AuthModule, OrgsModule, AttachmentsModule],
  controllers: [WebmailController],
  providers: [WebmailService],
})
export class WebmailModule {}
