"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { CreateDomainRequest, Domain } from "@justmail/contracts";
import { ApiError } from "@justmail/shared-utils";
import {
  Button,
  Card,
  Checkbox,
  Empty,
  FormField,
  Input,
  Modal,
  PageBody,
  PageHeader,
  SkeletonRows,
  StatusBadge,
  Table,
  TD,
  TH,
  THead,
  TR,
  useToast,
} from "@justmail/shared-ui";
import { Plus } from "lucide-react";
import { api } from "@/lib/api";

export default function DomainsPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const [showCreate, setShowCreate] = useState(false);
  const list = useQuery({
    queryKey: ["domains", orgId],
    queryFn: () => api.get<Domain[]>(`/v1/orgs/${orgId}/domains`),
  });

  return (
    <>
      <PageHeader
        title="Domains"
        description="Domains you host mail for, with verification and DNS state."
        actions={
          <Button
            variant="primary"
            onClick={() => setShowCreate(true)}
            leadingIcon={<Plus size={14} />}
          >
            Add domain
          </Button>
        }
      />
      <PageBody>
        {list.isLoading && <SkeletonRows count={5} />}
        {list.data && list.data.length === 0 && (
          <Empty
            title="No domains yet"
            description="Add a domain, verify DNS, then create mailboxes on it."
            action={
              <Button variant="primary" onClick={() => setShowCreate(true)}>
                Add your first domain
              </Button>
            }
          />
        )}
        {list.data && list.data.length > 0 && (
          <Card className="overflow-hidden">
            <Table>
              <THead>
                <TR>
                  <TH>Domain</TH>
                  <TH>Status</TH>
                  <TH>Mailboxes</TH>
                  <TH>Outbound</TH>
                  <TH></TH>
                </TR>
              </THead>
              <tbody>
                {list.data.map((d) => (
                  <TR key={d.id}>
                    <TD>
                      <span className="mono">{d.name}</span>
                      {d.is_primary && (
                        <span className="ml-2 text-[10px] font-medium text-[var(--color-neutral-900)]">
                          primary
                        </span>
                      )}
                    </TD>
                    <TD>
                      <StatusBadge status={d.status} />
                    </TD>
                    <TD>{d.mailbox_count}</TD>
                    <TD>
                      <span className="text-xs">{d.outbound_mode}</span>
                    </TD>
                    <TD className="text-right">
                      <Link
                        href={`/orgs/${orgId}/domains/${d.id}`}
                        className="text-xs text-[var(--color-accent)] hover:underline"
                      >
                        Manage →
                      </Link>
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </Card>
        )}
      </PageBody>
      {showCreate && (
        <CreateModal orgId={orgId} onClose={() => setShowCreate(false)} />
      )}
    </>
  );
}

function CreateModal({ orgId, onClose }: { orgId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const f = useForm<CreateDomainRequest>({
    defaultValues: { name: "" },
  });
  const { toast } = useToast();
  const [err, setErr] = useState<string | null>(null);
  const mut = useMutation({
    mutationFn: (body: CreateDomainRequest) =>
      api.post<Domain>(`/v1/orgs/${orgId}/domains`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["domains", orgId] });
      toast({ title: "Domain added", tone: "ok" });
      onClose();
    },
    onError: (e) =>
      setErr(
        e instanceof ApiError
          ? e.problem.detail ?? e.problem.title
          : (e as Error).message,
      ),
  });
  return (
    <Modal
      open
      onClose={onClose}
      title="Add domain"
      description="We'll seed the recommended DNS records; you sync them to your provider next."
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
              mut.mutate({
                name: v.name.trim().toLowerCase(),
                is_primary: v.is_primary,
              });
            })}
          >
            Add domain
          </Button>
        </>
      }
    >
      <form className="space-y-3">
        <FormField label="Domain">
          <Input
            placeholder="example.com"
            autoFocus
            monospace
            {...f.register("name", { required: true })}
          />
        </FormField>
        <label className="flex items-center gap-2 text-sm text-[var(--color-neutral-1000)]">
          <Checkbox {...f.register("is_primary")} />
          Make this the primary domain for outbound
        </label>
        {err && (
          <p className="text-xs text-[var(--color-bad)]" role="alert">
            {err}
          </p>
        )}
      </form>
    </Modal>
  );
}
