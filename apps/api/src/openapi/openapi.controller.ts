import { Controller, Get, Header } from "@nestjs/common";
import { buildOpenApiSpec } from "./spec";

// Standalone API reference. Scalar renders the spec served at ./openapi.json
// (relative to /v1/docs) entirely client-side; no build step or auth needed.
const DOCS_HTML = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>JustMail API reference</title>
  </head>
  <body>
    <script id="api-reference" data-url="./openapi.json"></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>`;

@Controller()
export class OpenApiController {
  @Get("openapi.json")
  @Header("content-type", "application/json")
  spec() {
    return buildOpenApiSpec();
  }

  @Get("docs")
  @Header("content-type", "text/html; charset=utf-8")
  docs() {
    return DOCS_HTML;
  }
}
