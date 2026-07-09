import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrgsModule } from "../orgs/orgs.module";
import { QueueController } from "./queue.controller";
import { QueueService } from "./queue.service";

@Module({
  imports: [AuthModule, OrgsModule],
  controllers: [QueueController],
  providers: [QueueService],
})
export class QueueModule {}
