import { z } from "zod";

// Reusable primitives referenced by every domain schema.

export const Uuid = z.string().uuid();
export type Uuid = z.infer<typeof Uuid>;

export const Email = z.string().email().max(254);
export type Email = z.infer<typeof Email>;

// RFC 1035 hostname. Kept as one long regex so validation is unified across
// every schema that accepts a domain.
export const Hostname = z
  .string()
  .regex(
    /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/,
    "must be a valid domain",
  );
export type Hostname = z.infer<typeof Hostname>;

// Local part before @. Deliberately more permissive than RFC 5322 to avoid
// annoying users; server-side still normalises to lowercase.
export const LocalPart = z
  .string()
  .regex(/^[a-z0-9._%+-]{1,64}$/i, "invalid local part")
  .transform((s) => s.toLowerCase());
export type LocalPart = z.infer<typeof LocalPart>;

// URL-safe slug for orgs, teams, plugin names.
export const Slug = z
  .string()
  .regex(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/, "invalid slug");
export type Slug = z.infer<typeof Slug>;

export const IsoDate = z.string().datetime({ offset: true });
export type IsoDate = z.infer<typeof IsoDate>;

// Two-letter ISO 3166-1 alpha-2 country code, uppercased.
export const Iso2 = z
  .string()
  .length(2)
  .regex(/^[A-Za-z]{2}$/)
  .transform((s) => s.toUpperCase());
export type Iso2 = z.infer<typeof Iso2>;

// Cursor-based pagination envelope. Every list endpoint uses this shape.
export const Page = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    items: z.array(item),
    next_cursor: z.string().nullable(),
  });

// Standard filter/sort/limit query shape for list endpoints.
export const ListQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  sort: z.string().optional(),
  q: z.string().optional(),
});
export type ListQuery = z.infer<typeof ListQuery>;
