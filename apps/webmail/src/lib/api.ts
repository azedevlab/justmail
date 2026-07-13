"use client";
import { createClient } from "@justmail/shared-utils";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4000";

// Tag every request so the API reads the webmail-scoped session cookie, keeping
// the mailbox session isolated from the admin console.
export const api = createClient(API_BASE, {
  defaultHeaders: { "x-jm-app": "webmail" },
});
