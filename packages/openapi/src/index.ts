import { z, type ZodTypeAny } from "zod";

/**
 * OpenAPI 3.1 builder. Consumers register routes at boot; the builder
 * produces a document with references to shared component schemas so the
 * spec stays small and diff-able.
 */

export interface RouteSpec {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  summary: string;
  tags: string[];
  auth?: Array<"session" | "bearer" | "none">;
  requestBody?: ZodTypeAny;
  responses: Record<string, { description: string; schema?: ZodTypeAny }>;
  params?: Array<{
    name: string;
    in: "path" | "query" | "header";
    required?: boolean;
    schema?: ZodTypeAny;
    description?: string;
  }>;
  operationId?: string;
}

export class OpenApiBuilder {
  private readonly routes: RouteSpec[] = [];
  private readonly schemas = new Map<string, unknown>();

  constructor(
    public readonly meta: {
      title: string;
      version: string;
      description?: string;
      servers?: Array<{ url: string; description?: string }>;
    },
  ) {}

  add(route: RouteSpec): this {
    this.routes.push(route);
    return this;
  }

  addSchema(name: string, schema: ZodTypeAny): this {
    this.schemas.set(name, z.toJSONSchema(schema, { unrepresentable: "any" }));
    return this;
  }

  build(): Record<string, unknown> {
    const paths: Record<string, Record<string, unknown>> = {};
    for (const r of this.routes) {
      const path = paths[r.path] ?? (paths[r.path] = {});
      path[r.method.toLowerCase()] = this.operation(r);
    }
    return {
      openapi: "3.1.0",
      info: {
        title: this.meta.title,
        version: this.meta.version,
        description: this.meta.description,
      },
      servers: this.meta.servers ?? [{ url: "/v1" }],
      security: [{ CookieAuth: [] }, { BearerAuth: [] }],
      tags: this.tags(),
      paths,
      components: {
        securitySchemes: {
          CookieAuth: { type: "apiKey", in: "cookie", name: "jm_session" },
          BearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "jm_*",
          },
        },
        schemas: Object.fromEntries(this.schemas),
      },
    };
  }

  private operation(r: RouteSpec) {
    const security = r.auth?.map((a) =>
      a === "session"
        ? { CookieAuth: [] }
        : a === "bearer"
        ? { BearerAuth: [] }
        : {},
    );

    return {
      operationId: r.operationId,
      summary: r.summary,
      tags: r.tags,
      ...(security ? { security } : {}),
      ...(r.params
        ? {
            parameters: r.params.map((p) => ({
              name: p.name,
              in: p.in,
              required: p.required ?? p.in === "path",
              description: p.description,
              schema: p.schema
                ? z.toJSONSchema(p.schema, { unrepresentable: "any" })
                : { type: "string" },
            })),
          }
        : {}),
      ...(r.requestBody
        ? {
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: z.toJSONSchema(r.requestBody, { unrepresentable: "any" }),
                },
              },
            },
          }
        : {}),
      responses: Object.fromEntries(
        Object.entries(r.responses).map(([code, resp]) => [
          code,
          {
            description: resp.description,
            content: resp.schema
              ? {
                  "application/json": {
                    schema: z.toJSONSchema(resp.schema, { unrepresentable: "any" }),
                  },
                }
              : undefined,
          },
        ]),
      ),
    };
  }

  private tags(): Array<{ name: string }> {
    const set = new Set<string>();
    for (const r of this.routes) for (const t of r.tags) set.add(t);
    return [...set].sort().map((name) => ({ name }));
  }
}
