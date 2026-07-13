import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { WsAdapter } from "@nestjs/platform-ws";
import cookieParser from "cookie-parser";
import {
  json,
  urlencoded,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { AppModule } from "./app.module";
import { config } from "./config";
import { Db } from "./db/db.service";
import { runMigrations } from "./db/migrate";
import { ProblemFilter } from "./common/problem.filter";

async function bootstrap(): Promise<void> {
  const logger = new Logger("bootstrap");
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  // Large bodies are scoped to the webmail send route only (base64 attachments);
  // every other endpoint keeps a small default so a big payload can't DoS them.
  // Registered before the global parser so body-parser marks req._body and the
  // global json() skips these requests.
  const sendParser = json({ limit: config.WEBMAIL_SEND_BODY_LIMIT });
  // SAML posts the assertion as application/x-www-form-urlencoded to the ACS.
  const acsParser = urlencoded({ extended: false, limit: "2mb" });
  // SCIM clients send bodies as application/scim+json, which the default JSON
  // parser ignores; accept both content types on the SCIM routes.
  const scimParser = json({
    type: ["application/json", "application/scim+json"],
    limit: "2mb",
  });
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (
      req.method === "POST" &&
      /\/webmail\/mailboxes\/[^/]+\/send$/.test(req.path)
    ) {
      return sendParser(req, res, next);
    }
    if (req.method === "POST" && /\/auth\/sso\/[^/]+\/acs$/.test(req.path)) {
      return acsParser(req, res, next);
    }
    if (/\/scim\/v2\//.test(req.path)) {
      return scimParser(req, res, next);
    }
    return next();
  });
  app.useBodyParser("json", { limit: "2mb" });
  // Raw binary chunks for tus.io uploads.
  app.useBodyParser("raw", {
    type: "application/offset+octet-stream",
    limit: "10mb",
  });

  // Baseline security headers on every API response.
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
    next();
  });

  const ran = await runMigrations(app.get(Db).pool);
  if (ran.length > 0) logger.log(`applied migrations: ${ran.join(", ")}`);

  app.set("trust proxy", 1); // behind traefik
  app.use(cookieParser());
  app.setGlobalPrefix("v1", {
    exclude: [
      "healthz",
      "internal/events/ingest",
      "internal/dmarc/ingest",
      "internal/caldav/auth",
      ".well-known/mta-sts.txt",
    ],
  });
  app.useGlobalFilters(new ProblemFilter());
  app.useWebSocketAdapter(new WsAdapter(app));

  const corsOrigins = [
    config.JM_WEB_HOST,
    (config as unknown as { JM_ADMIN_HOST?: string }).JM_ADMIN_HOST,
    (config as unknown as { JM_WEBMAIL_HOST?: string }).JM_WEBMAIL_HOST,
    (config as unknown as { JM_LANDING_HOST?: string }).JM_LANDING_HOST,
  ]
    .filter((h): h is string => !!h)
    .map((h) => `https://${h}`);
  if (corsOrigins.length > 0) {
    app.enableCors({
      origin: corsOrigins,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
      // Explicitly allow the tus/chunked-upload headers so the attachment
      // upload preflight succeeds under credentialed CORS.
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "Upload-Offset",
        "Upload-Length",
        "Tus-Resumable",
        "X-Requested-With",
        // Identifies the calling app (admin/webmail) so the API reads that
        // app's session cookie and the two sessions stay isolated.
        "X-JM-App",
      ],
      exposedHeaders: ["Upload-Offset", "Location"],
      maxAge: 86400,
    });
  }
  app.enableShutdownHooks();

  // Traefik's websecure readTimeout (10m) is the intended boundary for slow
  // attachment-chunk uploads; Node's default 5-minute requestTimeout would cut
  // them off first, so sit just above it. headersTimeout keeps its 60s guard.
  const server = app.getHttpServer() as import("node:http").Server;
  server.requestTimeout = 11 * 60 * 1000;

  await app.listen(config.PORT, "0.0.0.0");
  logger.log(`justmail api listening on :${config.PORT}`);
}

void bootstrap();
