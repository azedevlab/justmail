"use client";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type { BootstrapRequest, LoginRequest } from "@justmail/types";
import { api, ApiError } from "../../lib/api";
import { useMe } from "../../lib/session";

export default function LoginPage() {
  const router = useRouter();
  const me = useMe();
  const [mode, setMode] = useState<"login" | "bootstrap" | null>(null);

  useEffect(() => {
    if (me.data) {
      router.replace(`/orgs/${me.data.orgs[0]?.id ?? ""}`);
    }
  }, [me.data, router]);

  useEffect(() => {
    if (mode !== null) return;
    api
      .get<{ bootstrapped: boolean }>("/v1/auth/status")
      .then((s) => setMode(s.bootstrapped ? "login" : "bootstrap"))
      .catch(() => setMode("login"));
  }, [mode]);

  if (!mode) return <Splash>Detecting install state…</Splash>;
  return (
    <Splash>
      <div className="w-full max-w-sm card p-6">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-brand-500)] grid place-items-center font-bold text-white">J</div>
          <div>
            <div className="font-semibold">JustMail</div>
            <div className="text-xs text-[var(--color-ink-400)]">
              {mode === "bootstrap" ? "Bootstrap admin account" : "Sign in to admin console"}
            </div>
          </div>
        </div>
        {mode === "bootstrap" ? (
          <BootstrapForm onDone={() => me.refetch()} />
        ) : (
          <LoginForm onDone={() => me.refetch()} />
        )}
      </div>
    </Splash>
  );
}

function Splash({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen grid place-items-center bg-gradient-to-b from-[var(--color-ink-950)] to-[var(--color-ink-900)]">
      {children}
    </main>
  );
}

function LoginForm({ onDone }: { onDone: () => void }) {
  const f = useForm<LoginRequest>({ defaultValues: { email: "", password: "" } });
  const [err, setErr] = useState<string | null>(null);
  const [needsTotp, setNeedsTotp] = useState(false);
  const mut = useMutation({
    mutationFn: (body: LoginRequest) => api.post("/v1/auth/login", body),
    onSuccess: onDone,
    onError: (e) => {
      if (e instanceof ApiError && e.problem.type?.includes("totp-required")) {
        setNeedsTotp(true);
        setErr("Enter your 6-digit 2FA code.");
      } else if (e instanceof ApiError) setErr(e.problem.detail ?? e.problem.title);
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
      <Field label="Email">
        <input className="input" type="email" autoComplete="email" {...f.register("email", { required: true })} />
      </Field>
      <Field label="Password">
        <input className="input" type="password" autoComplete="current-password" {...f.register("password", { required: true })} />
      </Field>
      {needsTotp && (
        <Field label="2FA code">
          <input className="input mono" inputMode="numeric" maxLength={6} {...f.register("totp_code")} />
        </Field>
      )}
      {err && <p className="text-xs text-[var(--color-bad-500)]">{err}</p>}
      <button className="btn btn-primary w-full" disabled={mut.isPending}>
        {mut.isPending ? "Signing in…" : "Sign in"}
      </button>
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
    onError: (e) => {
      setErr(e instanceof ApiError ? (e.problem.detail ?? e.problem.title) : (e as Error).message);
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
      <p className="text-xs text-[var(--color-ink-300)] leading-relaxed">
        No accounts exist yet. Create the first owner — you can add teammates later.
      </p>
      <Field label="Your name">
        <input className="input" {...f.register("name", { required: true })} />
      </Field>
      <Field label="Email">
        <input className="input" type="email" autoComplete="email" {...f.register("email", { required: true })} />
      </Field>
      <Field label="Password (min 12)">
        <input className="input" type="password" autoComplete="new-password" {...f.register("password", { required: true, minLength: 12 })} />
      </Field>
      <Field label="Organization name">
        <input className="input" {...f.register("org_name", { required: true })} />
      </Field>
      {err && <p className="text-xs text-[var(--color-bad-500)]">{err}</p>}
      <button className="btn btn-primary w-full" disabled={mut.isPending}>
        {mut.isPending ? "Bootstrapping…" : "Create admin account"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
