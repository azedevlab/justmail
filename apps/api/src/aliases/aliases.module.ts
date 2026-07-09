import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrgsModule } from "../orgs/orgs.module";
import { AliasesController } from "./aliases.controller";
import { AliasesService } from "./aliases.service";

@Module({
  imports: [AuthModule, OrgsModule],
  controllers: [AliasesController],
  providers: [AliasesService],
  exports: [AliasesService],
})
export class AliasesModule {}
