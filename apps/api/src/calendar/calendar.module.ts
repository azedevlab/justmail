import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrgsModule } from "../orgs/orgs.module";
import { CalendarController } from "./calendar.controller";
import { CalendarService } from "./calendar.service";

@Module({
  imports: [AuthModule, OrgsModule],
  controllers: [CalendarController],
  providers: [CalendarService],
})
export class CalendarModule {}
