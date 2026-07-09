import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrgsModule } from "../orgs/orgs.module";
import { MailboxesController } from "./mailboxes.controller";
import { MailboxesService } from "./mailboxes.service";

@Module({
  imports: [AuthModule, OrgsModule],
  controllers: [MailboxesController],
  providers: [MailboxesService],
  exports: [MailboxesService],
})
export class MailboxesModule {}
