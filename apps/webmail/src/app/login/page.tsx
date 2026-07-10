"use client";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import type { LoginRequest } from "@justmail/contracts";
import { ApiError } from "@justmail/shared-utils";
import {
  AuroraBackdrop,
  Button,
  Card,
  FormField,
  Input,
  Wordmark,
} from "@justmail/shared-ui";
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
  const [ssoBusy, setSsoBusy] = useState(false);
  const mut = useMutation({
    mutationFn: (b: LoginRequest) => api.post("/v1/auth/login", b),
    onSuccess: () => me.refetch(),
    onError: (e) =>
      setErr(
        e instanceof ApiError ? e.problem.detail ?? e.problem.title : (e as Error).message,
      ),
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
    <main className="relative min-h-screen grid place-items-center p-4 bg-[var(--color-bg)]">
      <AuroraBackdrop />
      <div className="relative w-full max-w-sm animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
        <div className="flex justify-center mb-6">
          <Wordmark size={36} sub="Webmail" />
        </div>
        <Card className="p-6 shadow-[var(--shadow-4)]">
          <h1 className="text-base font-semibold mb-1">Welcome back</h1>
          <p className="text-xs text-[var(--color-neutral-900)] mb-5">
            Sign in with your account to read and send mail.
          </p>
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
        </Card>
        <p className="mt-4 text-center text-[11px] text-[var(--color-neutral-700)]">
          JustMail — self-hosted mail platform
        </p>
      </div>
    </main>
  );
}
