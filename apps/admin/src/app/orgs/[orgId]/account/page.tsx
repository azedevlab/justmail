"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { startRegistration } from "@simplewebauthn/browser";
import QRCode from "qrcode";
import type { PasskeyInfo, TwoFaSetupResponse } from "@justmail/contracts";
import { ApiError } from "@justmail/shared-utils";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Empty,
  FormField,
  Input,
  PasswordInput,
  Modal,
  PageBody,
  PageHeader,
  SkeletonRows,
  Table,
  TD,
  TH,
  THead,
  TR,
  useToast,
} from "@justmail/shared-ui";
import { KeyRound, Plus, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { useMe } from "@/lib/session";

function errMsg(e: unknown): string {
  return e instanceof ApiError
    ? e.problem.detail ?? e.problem.title
    : (e as Error).message;
}

export default function AccountPage() {
  const me = useMe();
  return (
    <>
      <PageHeader
        title="Account & security"
        description="Two-factor authentication and passkeys."
      />
      <PageBody>
        <TwoFactorCard enabled={me.data?.totp_enabled ?? false} onChange={() => me.refetch()} />
        <PasskeysCard />
      </PageBody>
    </>
  );
}

function TwoFactorCard({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: () => void;
}) {
  const [setup, setSetup] = useState<{
    data: TwoFaSetupResponse;
    qr: string;
  } | null>(null);
  const [disableOpen, setDisableOpen] = useState(false);
  const { toast } = useToast();

  const begin = useMutation({
    mutationFn: () => api.post<TwoFaSetupResponse>("/v1/auth/2fa/setup"),
    onSuccess: async (data) => {
      const qr = await QRCode.toDataURL(data.otpauth_url, { margin: 1, width: 200 });
      setSetup({ data, qr });
    },
    onError: (e) => toast({ title: errMsg(e), tone: "bad" }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="inline-flex items-center gap-2">
            <ShieldCheck size={16} /> Two-factor authentication
          </span>
        </CardTitle>
        {enabled ? (
          <Badge tone="ok">Enabled</Badge>
        ) : (
          <Badge tone="muted">Off</Badge>
        )}
      </CardHeader>
      <CardBody>
        <p className="text-sm text-[var(--color-neutral-900)] mb-4">
          Protect your account with a time-based one-time code from an
          authenticator app.
        </p>
        {enabled ? (
          <Button variant="danger" onClick={() => setDisableOpen(true)}>
            Disable 2FA
          </Button>
        ) : (
          <Button
            variant="primary"
            loading={begin.isPending}
            onClick={() => begin.mutate()}
          >
            Set up 2FA
          </Button>
        )}
      </CardBody>
      {setup && (
        <VerifyTotpModal
          setup={setup}
          onClose={() => setSetup(null)}
          onDone={() => {
            setSetup(null);
            onChange();
            toast({ title: "Two-factor enabled", tone: "ok" });
          }}
        />
      )}
      {disableOpen && (
        <DisableTotpModal
          onClose={() => setDisableOpen(false)}
          onDone={() => {
            setDisableOpen(false);
            onChange();
            toast({ title: "Two-factor disabled", tone: "ok" });
          }}
        />
      )}
    </Card>
  );
}

function VerifyTotpModal({
  setup,
  onClose,
  onDone,
}: {
  setup: { data: TwoFaSetupResponse; qr: string };
  onClose: () => void;
  onDone: () => void;
}) {
  const f = useForm<{ totp_code: string }>({ defaultValues: { totp_code: "" } });
  const [err, setErr] = useState<string | null>(null);
  const mut = useMutation({
    mutationFn: (v: { totp_code: string }) =>
      api.post("/v1/auth/2fa/verify", v),
    onSuccess: onDone,
    onError: (e) => setErr(errMsg(e)),
  });
  return (
    <Modal
      open
      onClose={onClose}
      title="Set up two-factor authentication"
      description="Scan the QR code with your authenticator, then enter the 6-digit code."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={mut.isPending}
            onClick={f.handleSubmit((v) => {
              setErr(null);
              mut.mutate(v);
            })}
          >
            Verify & enable
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={setup.qr}
          alt="2FA QR code"
          className="rounded-lg border border-[var(--color-border)]"
          width={200}
          height={200}
        />
        <div className="w-full text-center">
          <p className="text-xs text-[var(--color-neutral-800)] mb-1">
            Or enter this key manually
          </p>
          <code className="mono text-xs break-all">{setup.data.secret}</code>
        </div>
        <FormField label="6-digit code" className="w-full">
          <Input
            inputMode="numeric"
            maxLength={6}
            monospace
            autoFocus
            {...f.register("totp_code", { required: true })}
          />
        </FormField>
        {err && (
          <p className="text-xs text-[var(--color-bad)] w-full" role="alert">
            {err}
          </p>
        )}
      </div>
    </Modal>
  );
}

function DisableTotpModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const f = useForm<{ password: string }>({ defaultValues: { password: "" } });
  const [err, setErr] = useState<string | null>(null);
  const mut = useMutation({
    mutationFn: (v: { password: string }) =>
      api.post("/v1/auth/2fa/disable", v),
    onSuccess: onDone,
    onError: (e) => setErr(errMsg(e)),
  });
  return (
    <Modal
      open
      onClose={onClose}
      title="Disable two-factor authentication"
      description="Confirm your password to turn off 2FA."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={mut.isPending}
            onClick={f.handleSubmit((v) => {
              setErr(null);
              mut.mutate(v);
            })}
          >
            Disable
          </Button>
        </>
      }
    >
      <FormField label="Password">
        <PasswordInput
          autoComplete="current-password"
          autoFocus
          {...f.register("password", { required: true })}
        />
      </FormField>
      {err && (
        <p className="text-xs text-[var(--color-bad)] mt-2" role="alert">
          {err}
        </p>
      )}
    </Modal>
  );
}

function PasskeysCard() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [naming, setNaming] = useState(false);
  const passkeys = useQuery({
    queryKey: ["passkeys"],
    queryFn: () => api.get<PasskeyInfo[]>("/v1/auth/passkeys"),
  });

  const register = useMutation({
    mutationFn: async (name: string) => {
      const options = await api.post<Parameters<typeof startRegistration>[0]["optionsJSON"]>(
        "/v1/auth/passkeys/register/options",
      );
      const response = await startRegistration({ optionsJSON: options });
      return api.post("/v1/auth/passkeys/register/verify", { name, response });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["passkeys"] });
      setNaming(false);
      toast({ title: "Passkey added", tone: "ok" });
    },
    onError: (e) => {
      setNaming(false);
      // The user dismissing the browser prompt throws; keep that quiet.
      if ((e as Error)?.name !== "NotAllowedError") {
        toast({ title: errMsg(e), tone: "bad" });
      }
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/v1/auth/passkeys/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["passkeys"] });
      toast({ title: "Passkey removed", tone: "ok" });
    },
    onError: (e) => toast({ title: errMsg(e), tone: "bad" }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="inline-flex items-center gap-2">
            <KeyRound size={16} /> Passkeys
          </span>
        </CardTitle>
        <Button
          variant="secondary"
          size="sm"
          leadingIcon={<Plus size={14} />}
          loading={register.isPending || naming}
          onClick={() => setNaming(true)}
        >
          Add passkey
        </Button>
      </CardHeader>
      <CardBody>
        {passkeys.isLoading && <SkeletonRows count={2} />}
        {passkeys.data && passkeys.data.length === 0 && (
          <Empty
            title="No passkeys yet"
            description="Add a passkey to sign in with Face ID, Touch ID, Windows Hello, or a security key — no password required."
          />
        )}
        {passkeys.data && passkeys.data.length > 0 && (
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Type</TH>
                <TH>Added</TH>
                <TH>Last used</TH>
                <TH></TH>
              </TR>
            </THead>
            <tbody>
              {passkeys.data.map((p) => (
                <TR key={p.id}>
                  <TD>{p.name}</TD>
                  <TD>
                    <Badge tone="muted">
                      {p.device_type === "multiDevice" ? "Synced" : "Device"}
                    </Badge>
                  </TD>
                  <TD className="text-xs">
                    {new Date(p.created_at).toLocaleDateString()}
                  </TD>
                  <TD className="text-xs">
                    {p.last_used_at
                      ? new Date(p.last_used_at).toLocaleString()
                      : "never"}
                  </TD>
                  <TD className="text-right">
                    <button
                      className="text-xs text-[var(--color-bad)] hover:underline"
                      onClick={() => remove.mutate(p.id)}
                    >
                      Remove
                    </button>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </CardBody>
      {naming && (
        <NamePasskeyModal
          onClose={() => setNaming(false)}
          onSubmit={(name) => register.mutate(name)}
          pending={register.isPending}
        />
      )}
    </Card>
  );
}

function NamePasskeyModal({
  onClose,
  onSubmit,
  pending,
}: {
  onClose: () => void;
  onSubmit: (name: string) => void;
  pending: boolean;
}) {
  const f = useForm<{ name: string }>({ defaultValues: { name: "" } });
  return (
    <Modal
      open
      onClose={onClose}
      title="Name this passkey"
      description="A label so you can recognise this device later."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={pending}
            onClick={f.handleSubmit((v) => onSubmit(v.name))}
          >
            Continue
          </Button>
        </>
      }
    >
      <FormField label="Passkey name">
        <Input
          placeholder="MacBook Pro, YubiKey, iPhone…"
          autoFocus
          {...f.register("name", { required: true })}
        />
      </FormField>
    </Modal>
  );
}
