import { BadRequestException, PipeTransform } from "@nestjs/common";
import { ZodType } from "zod";

export class ZodPipe<T> implements PipeTransform<unknown, T> {
  // Input generic is `unknown` so schemas with a transform (whose parsed input
  // type differs from the output type) are accepted as well.
  constructor(private readonly schema: ZodType<T, unknown>) {}

  transform(value: unknown): T {
    const parsed = this.schema.safeParse(value);
    if (!parsed.success) {
      throw new BadRequestException({
        title: "Validation failed",
        errors: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
    }
    return parsed.data;
  }
}
