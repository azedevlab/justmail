import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Response } from "express";

@Catch()
export class ProblemFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let title = "Internal Server Error";
    let type = "about:blank";
    let detail: string | undefined;
    let errors: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === "string") {
        title = body;
      } else if (typeof body === "object" && body !== null) {
        const b = body as Record<string, unknown>;
        title = (b.title as string) ?? (b.error as string) ?? exception.message;
        detail =
          (b.detail as string) ??
          (typeof b.message === "string" ? b.message : undefined);
        if (Array.isArray(b.message) && detail === undefined) {
          detail = b.message.join("; ");
        }
        if (b.type) type = b.type as string;
        if (b.errors) errors = b.errors;
      }
    } else {
      this.logger.error(
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    res
      .status(status)
      .type("application/problem+json")
      .json({ type, title, status, detail, errors });
  }
}
