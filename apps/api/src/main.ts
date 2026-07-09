import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
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
  if (config.JM_WEB_HOST) {
    app.enableCors({
      origin: `https://${config.JM_WEB_HOST}`,
      credentials: true,
    });
  }
  app.enableShutdownHooks();

  await app.listen(config.PORT, "0.0.0.0");
  logger.log(`justmail api listening on :${config.PORT}`);
}

void bootstrap();
