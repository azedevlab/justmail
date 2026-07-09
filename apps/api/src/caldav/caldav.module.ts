import { Module } from "@nestjs/common";
import { CaldavController } from "./caldav.controller";

@Module({ controllers: [CaldavController] })
export class CaldavModule {}
