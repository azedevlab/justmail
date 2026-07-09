"use client";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { AcceptInviteRequest, InvitePreview } from "@justmail/types";
import { api, ApiError } from "../../../lib/api";

export default function InviteAccept() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const preview = useQuery({
    queryKey: ["invite", token],
    queryFn: () => api.get<InvitePreview>(`/v1/invites/${token}`),
    retry: false,
  });
  const f = useForm<AcceptInviteRequest>({
    defaultValues: { password: "", name: "" },
  });
  const [err, setErr] = useState<string | null>(null);
  const mut = useMutation({
    mutationFn: (body: AcceptInviteRequest) =>
      api.post(`/v1/invites/${token}/accept`, body),
    onSuccess: () => router.replace("/"),
    onError: (e) =>
      setErr(e instanceof ApiError ? (e.problem.detail ?? e.problem.title) : (e as Error).message),
  });

  if (preview.isError) {
    return (
      <Splash>
        <div className="card p-6 max-w-sm">
          <div className="text-sm text-[var(--color-bad-500)]">
            {(preview.error as ApiError | undefined)?.problem.title ??
              "Invite invalid or expired"}
          </div>
        </div>
      </Splash>
    );
  }
  if (!preview.data) return <Splash>Loading invite…</Splash>;

  return (
    <Splash>
      <div className="w-full max-w-sm card p-6">
        <div className="text-sm text-[var(--color-ink-300)] mb-4">
          You&apos;ve been invited to{" "}
          <span className="text-[var(--color-ink-100)] font-medium">
            {preview.data.org_name}
          </span>{" "}
          as{" "}
          <span className="badge badge-muted">{preview.data.role}</span>
        </div>
        <form
          className="space-y-3"
          onSubmit={f.handleSubmit((v) => {
            setErr(null);
            mut.mutate(v);
          })}
        >
          {preview.data.needs_signup && (
            <label className="block">
              <span className="label">Your name</span>
              <input
                className="input"
                autoFocus
                {...f.register("name", { required: true })}
              />
            </label>
          )}
          <label className="block">
            <span className="label">
              {preview.data.needs_signup ? "Password (min 12)" : "Confirm password"}
            </span>
            <input
              className="input"
              type="password"
              {...f.register("password", { required: true, minLength: 12 })}
            />
          </label>
          {err && <p className="text-xs text-[var(--color-bad-500)]">{err}</p>}
          <button className="btn btn-primary w-full" disabled={mut.isPending}>
            {mut.isPending
              ? "Accepting…"
              : preview.data.needs_signup
              ? "Create account and join"
              : "Join organization"}
          </button>
        </form>
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
