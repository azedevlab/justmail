"use client";
import { useQuery } from "@tanstack/react-query";
import type { Me } from "@justmail/contracts";
import { ApiError } from "@justmail/shared-utils";
import { api } from "./api";

export function useMe() {
  return useQuery<Me | null>({
    queryKey: ["me"],
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
