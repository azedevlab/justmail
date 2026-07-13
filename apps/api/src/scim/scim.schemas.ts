import { z } from "zod";

// SCIM is extensible by design (RFC 7643 §2.1): identity providers routinely
// send attributes beyond the core schema, and rejecting them would break real
// provisioning. So these validate the envelope shape — a body must be an object
// with well-typed core fields — while passing the rest through untouched. This
// closes the "unvalidated write" gap (a non-object or wrong-typed Operations
// array previously reached the service and could throw deep in a transaction)
// without narrowing what a conformant provider may send.

const passthroughObject = z.object({}).passthrough();

export const ScimUserBody = z
  .object({
    schemas: z.array(z.string()).optional(),
    userName: z.string().optional(),
    externalId: z.string().optional(),
    displayName: z.string().optional(),
    active: z.boolean().optional(),
  })
  .passthrough();

export const ScimGroupBody = z
  .object({
    schemas: z.array(z.string()).optional(),
    displayName: z.string().optional(),
    externalId: z.string().optional(),
    members: z.array(passthroughObject).optional(),
  })
  .passthrough();

export const ScimPatchBody = z
  .object({
    schemas: z.array(z.string()).optional(),
    Operations: z
      .array(
        z
          .object({
            op: z.string(),
            path: z.string().optional(),
            value: z.unknown().optional(),
          })
          .passthrough(),
      )
      .default([]),
  })
  .passthrough();
