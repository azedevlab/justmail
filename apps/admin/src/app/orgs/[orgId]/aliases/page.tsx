"use client";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { Alias, CreateAliasRequest, Domain } from "@justmail/contracts";
import { ApiError } from "@justmail/shared-utils";
import {
  Button,
  Card,
  Empty,
  FormField,
  Input,
  Modal,
  PageBody,
  PageHeader,
  SkeletonRows,
  Spinner,
  Table,
  TD,
  TH,
  THead,
  TR,
  useConfirm,
  useToast,
} from "@justmail/shared-ui";
import { Plus } from "lucide-react";
import { api } from "@/lib/api";

export default function AliasesPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const qc = useQueryClient();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [showCreate, setShowCreate] = useState(false);
  const list = useQuery({
    queryKey: ["aliases", orgId],
    queryFn: () => api.get<Alias[]>(`/v1/orgs/${orgId}/aliases`),
  });
  const domains = useQuery({
    queryKey: ["domains", orgId],
    queryFn: () => api.get<Domain[]>(`/v1/orgs/${orgId}/domains`),
  });
  const del = useMutation({
    mutationFn: (id: string) => api.del(`/v1/orgs/${orgId}/aliases/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["aliases", orgId] });
      toast({ title: "Alias deleted", tone: "ok" });
    },
  });

  return (
    <>
      <PageHeader
        title="Aliases"
        description="Forwarding-only addresses that route to one or more destinations."
        actions={
          <Button
            variant="primary"
            leadingIcon={<Plus size={14} />}
            onClick={() => setShowCreate(true)}
          >
            Add alias
          </Button>
        }
      />
      <PageBody>
        {list.isLoading && <SkeletonRows count={3} />}
        {list.data && list.data.length === 0 && <Empty title="No aliases yet" />}
        {list.data && list.data.length > 0 && (
          <Card className="overflow-hidden">
            <Table>
              <THead>
                <TR>
                  <TH>Source</TH>
                  <TH>Destinations</TH>
                  <TH></TH>
                </TR>
              </THead>
              <tbody>
                {list.data.map((a) => (
                  <TR key={a.id}>
                    <TD>
                      <span className="mono">{a.address}</span>
                    </TD>
                    <TD>
                      <span className="mono text-xs">
                        {a.destinations.join(", ")}
                      </span>
                    </TD>
                    <TD className="text-right">
                      <button
                        className="text-xs text-[var(--color-bad)] hover:underline"
                        onClick={async () => {
                          if (
                            await confirm({
                              title: `Delete alias ${a.address}?`,
                              tone: "danger",
                              confirmLabel: "Delete",
                            })
                          )
                            del.mutate(a.id);
                        }}
                      >
                        Delete
                      </button>
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </Card>
        )}
      </PageBody>
      {showCreate && (
        <CreateModal
          orgId={orgId}
          domains={domains.data ?? []}
          loading={domains.isLoading}
          onClose={() => setShowCreate(false)}
        />
      )}
    </>
  );
}

function CreateModal({
  orgId,
  domains,
  loading,
  onClose,
}: {
  orgId: string;
  domains: Domain[];
  loading: boolean;
  onClose: () => void;
}) {
  // Until domains have loaded (and there is at least one), render a loading or
  // empty state. The form is a separate component so its useForm defaults are
  // initialised from a non-empty domain list — avoids an undefined domain_id.
  if (loading || domains.length === 0) {
    return (
      <Modal
        open
        onClose={onClose}
        title="Add alias"
        footer={
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        }
      >
        {loading ? (
          <div className="flex justify-center py-6">
            <Spinner size={22} />
          </div>
        ) : (
          <Empty
            title="No domains yet"
            description="Add and verify a domain before creating aliases."
          />
        )}
      </Modal>
    );
  }

  return <CreateAliasForm orgId={orgId} domains={domains} onClose={onClose} />;
}

function CreateAliasForm({
  orgId,
  domains,
  onClose,
}: {
  orgId: string;
  domains: Domain[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const f = useForm<{
    source: string;
    destinations_str: string;
    domain_id: string;
  }>({
    defaultValues: {
      source: "",
      destinations_str: "",
      domain_id: domains[0].id,
    },
  });
  const [err, setErr] = useState<string | null>(null);
  const mut = useMutation({
    mutationFn: (body: CreateAliasRequest & { domain_id: string }) => {
      const { domain_id, ...rest } = body;
      return api.post<Alias>(
        `/v1/orgs/${orgId}/domains/${domain_id}/aliases`,
        rest,
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["aliases", orgId] });
      toast({ title: "Alias created", tone: "ok" });
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
      title="Add alias"
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
              const dests = v.destinations_str
                .split(/[,\s]+/)
                .map((s) => s.trim())
                .filter(Boolean);
              if (dests.length === 0)
                return setErr("At least one destination required.");
              mut.mutate({
                source: v.source.toLowerCase(),
                destinations: dests,
                domain_id: v.domain_id,
              });
            })}
          >
            Create alias
          </Button>
        </>
      }
    >
      <form className="space-y-3">
        <FormField label="Source">
          <div className="flex gap-2">
            <Input
              placeholder="local-part"
              autoFocus
              monospace
              {...f.register("source", { required: true })}
            />
            <select
              className="px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm"
              {...f.register("domain_id", { required: true })}
            >
              {domains.map((d) => (
                <option key={d.id} value={d.id}>
                  @{d.name}
                </option>
              ))}
            </select>
          </div>
        </FormField>
        <FormField
          label="Destinations"
          hint="Comma or space separated"
        >
          <Input
            monospace
            placeholder="alice@example.com bob@example.com"
            {...f.register("destinations_str", { required: true })}
          />
        </FormField>
        {err && (
          <p className="text-xs text-[var(--color-bad)]" role="alert">
            {err}
          </p>
        )}
      </form>
    </Modal>
  );
}
