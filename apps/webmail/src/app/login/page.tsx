"use client";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import type { LoginRequest } from "@justmail/contracts";
import { ApiError } from "@justmail/shared-utils";
import { Button, Card, FormField, Input } from "@justmail/shared-ui";
import { api } from "@/lib/api";
import { useMe } from "@/lib/session";

export default function LoginPage() {
  const me = useMe();
  const router = useRouter();
  useEffect(() => {
    if (me.data) router.replace("/");
  }, [me.data, router]);

  const f = useForm<LoginRequest>({ defaultValues: { email: "", password: "" } });
  const [err, setErr] = useState<string | null>(null);
  const mut = useMutation({
    mutationFn: (b: LoginRequest) => api.post("/v1/auth/login", b),
    onSuccess: () => me.refetch(),
    onError: (e) =>
      setErr(
        e instanceof ApiError ? e.problem.detail ?? e.problem.title : (e as Error).message,
      ),
  });

  return (
    <main className="min-h-screen grid place-items-center p-4 bg-gradient-to-b from-[var(--color-neutral-0)] to-[var(--color-neutral-100)]">
      <Card className="w-full max-w-sm p-6">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-9 h-9 rounded-lg bg-[var(--color-brand-500)] grid place-items-center font-bold text-white">
            J
          </div>
          <div>
            <div className="font-semibold">JustMail</div>
            <div className="text-xs text-[var(--color-neutral-900)]">
              Sign in to webmail
            </div>
          </div>
        </div>
        <form
          className="space-y-3"
          onSubmit={f.handleSubmit((v) => {
            setErr(null);
            mut.mutate(v);
          })}
        >
          <FormField label="Email">
            <Input
              type="email"
              autoComplete="email"
              autoFocus
              {...f.register("email", { required: true })}
            />
          </FormField>
          <FormField label="Password">
            <Input
              type="password"
              autoComplete="current-password"
              {...f.register("password", { required: true })}
            />
          </FormField>
          {err && (
            <p className="text-xs text-[var(--color-bad)]" role="alert">
              {err}
            </p>
          )}
          <Button variant="primary" className="w-full" loading={mut.isPending}>
            Sign in
          </Button>
        </form>
      </Card>
    </main>
  );
}
