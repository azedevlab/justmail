import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrgsModule } from "../orgs/orgs.module";
import { ThemesController } from "./themes.controller";
import { ThemesService } from "./themes.service";

@Module({
  imports: [AuthModule, OrgsModule],
  controllers: [ThemesController],
  providers: [ThemesService],
  exports: [ThemesService],
})
export class ThemesModule {}
