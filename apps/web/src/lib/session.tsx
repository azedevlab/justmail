"use client";
import { useQuery } from "@tanstack/react-query";
import type { Me } from "@justmail/types";
import { api, ApiError } from "./api";

export function useMe(enabled = true) {
  return useQuery<Me | null>({
    queryKey: ["me"],
    enabled,
    queryFn: async () => {
      try {
        return await api.get<Me>("/v1/auth/me");
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
  });
}
