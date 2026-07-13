"use client";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { startAuthentication } from "@simplewebauthn/browser";
import type {
  BootstrapRequest,
  LoginRequest,
  PasskeyAuthOptionsResponse,
} from "@justmail/contracts";
import { ApiError } from "@justmail/shared-utils";
import {
  AuroraBackdrop,
  Button,
  Card,
  FormField,
  Input,
  PasswordInput,
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
  const [passkeyBusy, setPasskeyBusy] = useState(false);
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

  async function continueWithPasskey() {
    setErr(null);
    // Usernameless: an email narrows the prompt when given, but the passkey
    // itself identifies the account so it isn't required.
    const email = f.getValues("email").trim();
    setPasskeyBusy(true);
    try {
      const { challenge_id, options } =
        await api.post<PasskeyAuthOptionsResponse>(
          "/v1/auth/passkeys/login/options",
          email ? { email } : {},
        );
      const response = await startAuthentication({
        optionsJSON: options as Parameters<
          typeof startAuthentication
        >[0]["optionsJSON"],
      });
      await api.post("/v1/auth/passkeys/login/verify", {
        challenge_id,
        response,
      });
      onDone();
    } catch (e) {
      if ((e as Error)?.name !== "NotAllowedError") {
        setErr(
          e instanceof ApiError
            ? e.problem.detail ?? e.problem.title
            : (e as Error).message,
        );
      }
    } finally {
      setPasskeyBusy(false);
    }
  }

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
        if (!v.email.trim() || !v.password) {
          setErr("Enter your email and password.");
          return;
        }
        mut.mutate(v);
      })}
    >
      <FormField label="Email">
        <Input type="email" autoComplete="email" {...f.register("email")} />
      </FormField>
      <FormField label="Password">
        <PasswordInput autoComplete="current-password" {...f.register("password")} />
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
      <Button type="submit" variant="primary" className="w-full" loading={mut.isPending}>
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
        loading={passkeyBusy}
        onClick={continueWithPasskey}
      >
        Sign in with a passkey
      </Button>
      <Button
        type="button"
        variant="ghost"
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
  const [bootstrapToken, setBootstrapToken] = useState("");
  const mut = useMutation({
    mutationFn: (body: BootstrapRequest) =>
      api.post("/v1/auth/bootstrap", body, {
        headers: bootstrapToken.trim()
          ? { "x-bootstrap-token": bootstrapToken.trim() }
          : undefined,
      }),
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
        if (!v.name.trim() || !v.email.trim() || !v.org_name.trim()) {
          setErr("Fill in your name, email, and organization name.");
          return;
        }
        if (v.password.length < 12) {
          setErr("Password must be at least 12 characters.");
          return;
        }
        mut.mutate(v);
      })}
    >
      <p className="text-xs text-[var(--color-neutral-900)] leading-relaxed">
        No accounts exist yet. Create the first owner — teammates can be invited later.
      </p>
      <FormField label="Your name">
        <Input {...f.register("name")} />
      </FormField>
      <FormField label="Email">
        <Input type="email" autoComplete="email" {...f.register("email")} />
      </FormField>
      <FormField label="Password (min 12)">
        <PasswordInput autoComplete="new-password" {...f.register("password")} />
      </FormField>
      <FormField label="Organization name">
        <Input {...f.register("org_name")} />
      </FormField>
      <FormField
        label="Bootstrap token"
        hint="Required in production — printed in the server logs on first boot."
      >
        <Input
          monospace
          autoComplete="off"
          value={bootstrapToken}
          onChange={(e) => setBootstrapToken(e.target.value)}
        />
      </FormField>
      {err && (
        <p className="text-xs text-[var(--color-bad)]" role="alert">
          {err}
        </p>
      )}
      <Button type="submit" variant="primary" className="w-full" loading={mut.isPending}>
        Create admin account
      </Button>
    </form>
  );
}
