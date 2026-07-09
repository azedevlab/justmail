import { Global, Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrgsModule } from "../orgs/orgs.module";
import { ApiKeysController } from "./apikeys.controller";
import { ApiKeysService } from "./apikeys.service";

@Global()
@Module({
  imports: [AuthModule, OrgsModule],
  controllers: [ApiKeysController],
  providers: [ApiKeysService],
  exports: [ApiKeysService],
})
export class ApiKeysModule {}
