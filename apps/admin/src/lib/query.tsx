"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { ToastProvider, TooltipProvider } from "@justmail/shared-ui";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: (fail, err) => {
              const status = (err as { status?: number }).status ?? 0;
              if ([401, 403, 404].includes(status)) return false;
              return fail < 2;
            },
            staleTime: 15_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <ToastProvider>{children}</ToastProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
