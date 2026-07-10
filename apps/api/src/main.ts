import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { WsAdapter } from "@nestjs/platform-ws";
import cookieParser from "cookie-parser";
import { json, type NextFunction, type Request, type Response } from "express";
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
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (
      req.method === "POST" &&
      /\/webmail\/mailboxes\/[^/]+\/send$/.test(req.path)
    ) {
      return sendParser(req, res, next);
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
    app.enableCors({ origin: corsOrigins, credentials: true });
  }
  app.enableShutdownHooks();

  await app.listen(config.PORT, "0.0.0.0");
  logger.log(`justmail api listening on :${config.PORT}`);
}

void bootstrap();
