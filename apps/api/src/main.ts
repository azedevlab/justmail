import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { WsAdapter } from "@nestjs/platform-ws";
import cookieParser from "cookie-parser";
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
  // vector batches up to 100 log events (docker caps lines at 16KB) — the
  // express default of 100kb rejects them with 413
  app.useBodyParser("json", { limit: "2mb" });
  // Raw binary chunks for tus.io uploads.
  app.useBodyParser("raw", {
    type: "application/offset+octet-stream",
    limit: "10mb",
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
