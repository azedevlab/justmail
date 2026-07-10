"use client";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type { BootstrapRequest, LoginRequest } from "@justmail/contracts";
import { ApiError } from "@justmail/shared-utils";
import {
  Button,
  Card,
  FormField,
  Input,
  Spinner,
} from "@justmail/shared-ui";
import { api } from "@/lib/api";
import { useMe } from "@/lib/session";

export default function LoginPage() {
  const router = useRouter();
  const me = useMe();
  const [mode, setMode] = useState<"login" | "bootstrap" | null>(null);

  useEffect(() => {
    if (me.data)
      router.replace(`/orgs/${me.data.orgs[0]?.id ?? ""}`);
  }, [me.data, router]);

  useEffect(() => {
    if (mode !== null) return;
    api
      .get<{ bootstrapped: boolean }>("/v1/auth/status")
      .then((s) => setMode(s.bootstrapped ? "login" : "bootstrap"))
      .catch(() => setMode("login"));
  }, [mode]);

  return (
    <main className="min-h-screen grid place-items-center bg-gradient-to-b from-[var(--color-neutral-0)] to-[var(--color-neutral-100)] p-4">
      {mode === null ? (
        <Spinner size={22} />
      ) : (
        <Card className="w-full max-w-sm p-6">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-9 h-9 rounded-lg bg-[var(--color-brand-500)] grid place-items-center font-bold text-white">
              J
            </div>
            <div>
              <div className="font-semibold">JustMail</div>
              <div className="text-xs text-[var(--color-neutral-900)]">
                {mode === "bootstrap"
                  ? "Bootstrap admin account"
                  : "Sign in to the console"}
              </div>
            </div>
          </div>
          {mode === "bootstrap" ? (
            <BootstrapForm onDone={() => me.refetch()} />
          ) : (
            <LoginForm onDone={() => me.refetch()} />
          )}
        </Card>
      )}
    </main>
  );
}

function LoginForm({ onDone }: { onDone: () => void }) {
  const f = useForm<LoginRequest>({ defaultValues: { email: "", password: "" } });
  const [needsTotp, setNeedsTotp] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const mut = useMutation({
    mutationFn: (body: LoginRequest) => api.post("/v1/auth/login", body),
    onSuccess: onDone,
    onError: (e) => {
      if (e instanceof ApiError && e.problem.type?.includes("totp-required")) {
        setNeedsTotp(true);
        setErr("Enter your 6-digit 2FA code.");
      } else if (e instanceof ApiError)
        setErr(e.problem.detail ?? e.problem.title);
      else setErr((e as Error).message);
    },
  });
  return (
    <form
      className="space-y-3"
      onSubmit={f.handleSubmit((v) => {
        setErr(null);
        mut.mutate(v);
      })}
    >
      <FormField label="Email">
        <Input type="email" autoComplete="email" {...f.register("email", { required: true })} />
      </FormField>
      <FormField label="Password">
        <Input type="password" autoComplete="current-password" {...f.register("password", { required: true })} />
      </FormField>
      {needsTotp && (
        <FormField label="2FA code">
          <Input inputMode="numeric" maxLength={6} monospace {...f.register("totp_code")} />
        </FormField>
      )}
      {err && (
        <p className="text-xs text-[var(--color-bad)]" role="alert">
          {err}
        </p>
      )}
      <Button variant="primary" className="w-full" loading={mut.isPending}>
        Sign in
      </Button>
    </form>
  );
}

function BootstrapForm({ onDone }: { onDone: () => void }) {
  const f = useForm<BootstrapRequest>({
    defaultValues: { email: "", name: "", org_name: "", password: "" },
  });
  const [err, setErr] = useState<string | null>(null);
  const mut = useMutation({
    mutationFn: (body: BootstrapRequest) => api.post("/v1/auth/bootstrap", body),
    onSuccess: onDone,
    onError: (e) =>
      setErr(
        e instanceof ApiError ? e.problem.detail ?? e.problem.title : (e as Error).message,
      ),
  });
  return (
    <form
      className="space-y-3"
      onSubmit={f.handleSubmit((v) => {
        setErr(null);
        mut.mutate(v);
      })}
    >
      <p className="text-xs text-[var(--color-neutral-900)] leading-relaxed">
        No accounts exist yet. Create the first owner — teammates can be invited later.
      </p>
      <FormField label="Your name">
        <Input {...f.register("name", { required: true })} />
      </FormField>
      <FormField label="Email">
        <Input type="email" autoComplete="email" {...f.register("email", { required: true })} />
      </FormField>
      <FormField label="Password (min 12)">
        <Input type="password" autoComplete="new-password" {...f.register("password", { required: true, minLength: 12 })} />
      </FormField>
      <FormField label="Organization name">
        <Input {...f.register("org_name", { required: true })} />
      </FormField>
      {err && (
        <p className="text-xs text-[var(--color-bad)]" role="alert">
          {err}
        </p>
      )}
      <Button variant="primary" className="w-full" loading={mut.isPending}>
        Create admin account
      </Button>
    </form>
  );
}
