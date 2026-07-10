import { Global, Module } from "@nestjs/common";
import { ClamavService } from "./clamav.service";

@Global()
@Module({
  providers: [ClamavService],
  exports: [ClamavService],
})
export class AvModule {}
