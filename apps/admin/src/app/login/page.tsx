"use client";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type { BootstrapRequest, LoginRequest } from "@justmail/contracts";
import { ApiError } from "@justmail/shared-utils";
import {
  AuroraBackdrop,
  Button,
  Card,
  FormField,
  Input,
  Spinner,
  Wordmark,
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
    <main className="relative min-h-screen grid place-items-center bg-[var(--color-bg)] p-4">
      <AuroraBackdrop />
      {mode === null ? (
        <Spinner size={22} />
      ) : (
        <div className="relative w-full max-w-sm animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
          <div className="flex justify-center mb-6">
            <Wordmark size={36} sub="Control plane" />
          </div>
          <Card className="p-6 shadow-[var(--shadow-4)]">
            <h1 className="text-base font-semibold mb-1">
              {mode === "bootstrap" ? "Create the first account" : "Welcome back"}
            </h1>
            <p className="text-xs text-[var(--color-neutral-900)] mb-5">
              {mode === "bootstrap"
                ? "Set up the owner account for this server."
                : "Sign in to manage domains, mailboxes and delivery."}
            </p>
            {mode === "bootstrap" ? (
              <BootstrapForm onDone={() => me.refetch()} />
            ) : (
              <LoginForm onDone={() => me.refetch()} />
            )}
          </Card>
          <p className="mt-4 text-center text-[11px] text-[var(--color-neutral-700)]">
            JustMail — self-hosted mail platform
          </p>
        </div>
      )}
    </main>
  );
}

function LoginForm({ onDone }: { onDone: () => void }) {
  const f = useForm<LoginRequest>({ defaultValues: { email: "", password: "" } });
  const [needsTotp, setNeedsTotp] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ssoBusy, setSsoBusy] = useState(false);
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

  async function continueWithSso() {
    setErr(null);
    const email = f.getValues("email").trim();
    if (!email) {
      setErr("Enter your email to continue with SSO.");
      return;
    }
    setSsoBusy(true);
    try {
      const { provider } = await api.get<{
        provider: { login_url: string } | null;
      }>(`/v1/auth/sso/discover?email=${encodeURIComponent(email)}`);
      if (!provider) {
        setErr("No SSO provider is configured for this email domain.");
        return;
      }
      const relay = encodeURIComponent(window.location.origin);
      window.location.href = `${provider.login_url}?relay=${relay}`;
    } catch (e) {
      setErr(
        e instanceof ApiError ? e.problem.detail ?? e.problem.title : (e as Error).message,
      );
    } finally {
      setSsoBusy(false);
    }
  }

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
      <div className="flex items-center gap-2 py-0.5">
        <span className="h-px flex-1 bg-[var(--color-border)]" />
        <span className="text-[11px] text-[var(--color-neutral-700)]">or</span>
        <span className="h-px flex-1 bg-[var(--color-border)]" />
      </div>
      <Button
        type="button"
        variant="secondary"
        className="w-full"
        loading={ssoBusy}
        onClick={continueWithSso}
      >
        Continue with SSO
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
