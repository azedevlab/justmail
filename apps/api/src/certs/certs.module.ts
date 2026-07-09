import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrgsModule } from "../orgs/orgs.module";
import { CertsController } from "./certs.controller";
import { CertsService } from "./certs.service";

@Module({
  imports: [AuthModule, OrgsModule],
  controllers: [CertsController],
  providers: [CertsService],
})
export class CertsModule {}
