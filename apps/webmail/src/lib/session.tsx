"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
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

export function useLogout() {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: () => api.post("/v1/auth/logout"),
    // Always clear cached data and leave the app, even if the request fails —
    // an expired session still means the user is signed out locally.
    onSettled: () => {
      qc.clear();
      router.replace("/login");
    },
  });
}
