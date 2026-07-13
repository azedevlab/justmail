"use client";
import { useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar, Button, Modal, useToast } from "@justmail/shared-ui";
import { ApiError } from "@justmail/shared-utils";
import { api } from "@/lib/api";
import { useMe } from "@/lib/session";

interface AvatarResult {
  data_url: string | null;
}

// The webmail routes are all scoped to /orgs/:orgId/webmail/mailboxes/:mailboxId;
// both ids are stable for the page, so any avatar can resolve its own base path
// from the shared (deduped) `me` query and the route param.
function useAvatarBase(): string | null {
  const me = useMe();
  const { mailboxId } = useParams<{ mailboxId: string }>();
  const orgId = me.data?.orgs[0]?.id;
  return orgId && mailboxId
    ? `/v1/orgs/${orgId}/webmail/mailboxes/${mailboxId}`
    : null;
}

function avatarKey(email?: string | null): string {
  return (email ?? "").trim().toLowerCase();
}

export function useSenderAvatar(email?: string | null) {
  const base = useAvatarBase();
  const key = avatarKey(email);
  return useQuery<AvatarResult>({
    queryKey: ["avatar", key],
    enabled: !!key && !!base,
    // Avatars change rarely; keep them warm across the session and dedupe the
    // many identical sender lookups a message list produces.
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    retry: false,
    queryFn: () =>
      api.get<AvatarResult>(`${base}/avatar?email=${encodeURIComponent(key)}`),
  });
}

export function SenderAvatar({
  email,
  name,
  size = 28,
  className,
}: {
  email?: string | null;
  name: string;
  size?: number;
  className?: string;
}) {
  const q = useSenderAvatar(email);
  return (
    <Avatar
      name={name}
      size={size}
      src={q.data?.data_url ?? null}
      className={className}
    />
  );
}

// Draw the chosen file onto a square canvas, cropping to cover, so uploads stay
// tiny (~a few KB) regardless of the source resolution.
async function toSquareDataUrl(file: File, edge = 256): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;
  const canvas = document.createElement("canvas");
  canvas.width = edge;
  canvas.height = edge;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, edge, edge);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.9);
}

export function ProfilePictureModal({
  open,
  onClose,
  email,
  name,
}: {
  open: boolean;
  onClose: () => void;
  email: string;
  name: string;
}) {
  const base = useAvatarBase();
  const qc = useQueryClient();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const current = useSenderAvatar(email);
  const [preview, setPreview] = useState<string | null>(null);
  const hasAvatar = !!(preview ?? current.data?.data_url);

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["avatar", avatarKey(email)] });

  const save = useMutation({
    mutationFn: (dataUrl: string) =>
      api.put(`${base}/profile/avatar`, { data_url: dataUrl }),
    onSuccess: async () => {
      await invalidate();
      toast({ title: "Profile picture updated" });
      setPreview(null);
      onClose();
    },
    onError: (e) =>
      toast({
        title: e instanceof ApiError ? e.message : "Upload failed",
        tone: "bad",
      }),
  });

  const remove = useMutation({
    mutationFn: () => api.del(`${base}/profile/avatar`),
    onSuccess: async () => {
      await invalidate();
      toast({ title: "Profile picture removed" });
      setPreview(null);
      onClose();
    },
    onError: () => toast({ title: "Could not remove picture", tone: "bad" }),
  });

  async function pick(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Choose an image file", tone: "bad" });
      return;
    }
    try {
      const dataUrl = await toSquareDataUrl(file);
      setPreview(dataUrl);
      save.mutate(dataUrl);
    } catch {
      toast({ title: "Could not read that image", tone: "bad" });
    }
  }

  const busy = save.isPending || remove.isPending;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Profile picture"
      description="Shown in your mailbox and to other JustMail users you email."
      footer={
        <div className="flex items-center justify-between w-full">
          {hasAvatar ? (
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => remove.mutate()}
            >
              Remove
            </Button>
          ) : (
            <span />
          )}
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            Done
          </Button>
        </div>
      }
    >
      <div className="flex flex-col items-center gap-4 py-2">
        <Avatar
          name={name}
          size={96}
          src={preview ?? current.data?.data_url ?? null}
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => void pick(e.target.files?.[0])}
        />
        <Button
          variant="primary"
          size="sm"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? "Uploading…" : hasAvatar ? "Change picture" : "Upload picture"}
        </Button>
        <p className="text-[12px] text-[var(--color-neutral-700)] text-center">
          PNG, JPEG, WebP, or GIF. Cropped to a square.
        </p>
      </div>
    </Modal>
  );
}
