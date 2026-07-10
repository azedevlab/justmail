"use client";
import { createClient } from "@justmail/shared-utils";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4000";

export const api = createClient(API_BASE);
