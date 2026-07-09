import { Controller, Get, Header } from "@nestjs/common";
import { buildOpenApiSpec } from "./spec";

@Controller()
export class OpenApiController {
  @Get("openapi.json")
  @Header("content-type", "application/json")
  spec() {
    return buildOpenApiSpec();
  }
}
