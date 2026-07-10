"use client";
import { createClient } from "@justmail/shared-utils";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "https://api.justmail.dev";

export const api = createClient(API_BASE);
