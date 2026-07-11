"use client";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useState } from "react";
import type { AcceptInviteRequest, InvitePreview } from "@justmail/contracts";
import { ApiError } from "@justmail/shared-utils";
import { Button, Card, FormField, Input, PasswordInput, Spinner, Badge } from "@justmail/shared-ui";
import { api } from "@/lib/api";

export default function InviteAcceptPage() {
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
      setErr(
        e instanceof ApiError
          ? e.problem.detail ?? e.problem.title
          : (e as Error).message,
      ),
  });

  if (preview.isError) {
    return (
      <Splash>
        <Card className="p-6 max-w-sm">
          <div className="text-sm text-[var(--color-bad)]" role="alert">
            {(preview.error as ApiError | undefined)?.problem.title ??
              "Invite invalid or expired"}
          </div>
        </Card>
      </Splash>
    );
  }
  if (!preview.data) return <Splash><Spinner size={22} /></Splash>;

  return (
    <Splash>
      <Card className="w-full max-w-sm p-6">
        <div className="text-sm text-[var(--color-neutral-900)] mb-4">
          You&apos;ve been invited to{" "}
          <span className="text-[var(--color-neutral-1100)] font-medium">
            {preview.data.org_name}
          </span>{" "}
          as <Badge tone="muted">{preview.data.role}</Badge>
        </div>
        <form
          className="space-y-3"
          onSubmit={f.handleSubmit((v) => {
            setErr(null);
            mut.mutate(v);
          })}
        >
          {preview.data.needs_signup && (
            <FormField label="Your name">
              <Input autoFocus {...f.register("name", { required: true })} />
            </FormField>
          )}
          <FormField
            label={
              preview.data.needs_signup ? "Password (min 12)" : "Confirm password"
            }
          >
            <PasswordInput
              {...f.register("password", { required: true, minLength: 12 })}
            />
          </FormField>
          {err && (
            <p className="text-xs text-[var(--color-bad)]" role="alert">
              {err}
            </p>
          )}
          <Button
            variant="primary"
            className="w-full"
            loading={mut.isPending}
          >
            {preview.data.needs_signup ? "Create account and join" : "Join"}
          </Button>
        </form>
      </Card>
    </Splash>
  );
}

function Splash({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen grid place-items-center p-4 bg-gradient-to-b from-[var(--color-neutral-0)] to-[var(--color-neutral-100)]">
      {children}
    </main>
  );
}
