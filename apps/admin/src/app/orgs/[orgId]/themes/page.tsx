"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  FormField,
  Input,
  PageBody,
  PageHeader,
  Select,
  Spinner,
  Textarea,
  useToast,
} from "@justmail/shared-ui";
import { compileTheme } from "@justmail/theme-engine";
import type { Theme, ThemeTokens } from "@justmail/contracts";
import { api } from "@/lib/api";
import { DEFAULT_TOKENS, rampFromBase } from "@/lib/theme-defaults";

export default function ThemesPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const qc = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ["org-theme", orgId],
    queryFn: () => api.get<Theme | null>(`/v1/orgs/${orgId}/themes`),
  });

  const [name, setName] = useState("Brand");
  const [tokens, setTokens] = useState<ThemeTokens>(DEFAULT_TOKENS);
  const [cssExtra, setCssExtra] = useState("");

  // Seed the form from the saved theme once it loads.
  useEffect(() => {
    if (query.data) {
      setName(query.data.name);
      setTokens(query.data.tokens);
      setCssExtra(query.data.css_extra ?? "");
    }
  }, [query.data]);

  const set = <K extends keyof ThemeTokens>(key: K, value: ThemeTokens[K]) =>
    setTokens((t) => ({ ...t, [key]: value }));

  const previewCss = useMemo(
    () => compileTheme(tokens, { kind: "domain", id: "preview" }),
    [tokens],
  );

  const save = useMutation({
    mutationFn: () =>
      api.put<Theme>(`/v1/orgs/${orgId}/themes`, {
        name,
        tokens,
        css_extra: cssExtra,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-theme", orgId] });
      toast({ title: "Theme saved — console re-skinned", tone: "ok" });
    },
    onError: (e) => toast({ title: (e as Error).message, tone: "bad" }),
  });

  const resetDefaults = () => {
    setTokens(DEFAULT_TOKENS);
    setCssExtra("");
  };

  if (query.isLoading) {
    return (
      <main className="grid place-items-center py-20">
        <Spinner size={22} />
      </main>
    );
  }

  const brandBase = tokens.brand[6];

  return (
    <>
      <PageHeader
        title="Themes"
        description="Brand the console with your org's colors, fonts, and radius. Saved themes apply instantly — no rebuild."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={resetDefaults} disabled={save.isPending}>
              Reset
            </Button>
            <Button
              variant="primary"
              onClick={() => save.mutate()}
              disabled={save.isPending}
            >
              {save.isPending ? "Saving…" : "Save theme"}
            </Button>
          </div>
        }
      />
      <PageBody>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
          <div className="space-y-4">
            <Card className="p-5 space-y-4">
              <h3 className="text-sm font-semibold text-[var(--color-neutral-1100)]">
                Identity
              </h3>
              <FormField label="Theme name">
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Brand color" hint="Generates the full brand ramp.">
                  <ColorInput
                    value={brandBase}
                    onChange={(hex) => set("brand", rampFromBase(hex))}
                  />
                </FormField>
                <FormField label="Appearance">
                  <Select
                    value={tokens.mode}
                    onChange={(e) =>
                      set("mode", e.target.value as ThemeTokens["mode"])
                    }
                  >
                    <option value="system">System</option>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </Select>
                </FormField>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField label="Success">
                  <ColorInput value={tokens.ok} onChange={(hex) => set("ok", hex)} />
                </FormField>
                <FormField label="Warning">
                  <ColorInput value={tokens.warn} onChange={(hex) => set("warn", hex)} />
                </FormField>
                <FormField label="Danger">
                  <ColorInput value={tokens.bad} onChange={(hex) => set("bad", hex)} />
                </FormField>
              </div>
            </Card>

            <Card className="p-5 space-y-4">
              <h3 className="text-sm font-semibold text-[var(--color-neutral-1100)]">
                Typography & shape
              </h3>
              <FormField label="Sans-serif font stack">
                <Input
                  value={tokens.font_sans}
                  onChange={(e) => set("font_sans", e.target.value)}
                />
              </FormField>
              <FormField label="Monospace font stack">
                <Input
                  value={tokens.font_mono}
                  onChange={(e) => set("font_mono", e.target.value)}
                />
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Base radius (px)">
                  <Input
                    type="number"
                    value={tokens.radius_base}
                    onChange={(e) => set("radius_base", Number(e.target.value))}
                  />
                </FormField>
                <FormField label="Large radius (px)">
                  <Input
                    type="number"
                    value={tokens.radius_lg}
                    onChange={(e) => set("radius_lg", Number(e.target.value))}
                  />
                </FormField>
              </div>
            </Card>

            <Card className="p-5 space-y-3">
              <h3 className="text-sm font-semibold text-[var(--color-neutral-1100)]">
                Advanced CSS
              </h3>
              <p className="text-[13px] text-[var(--color-neutral-900)]">
                Extra CSS appended after the compiled tokens, scoped to this org.
              </p>
              <FormField label="Custom CSS" htmlFor="css-extra">
                <Textarea
                  id="css-extra"
                  rows={5}
                  value={cssExtra}
                  onChange={(e) => setCssExtra(e.target.value)}
                  placeholder="[data-org] .some-class { … }"
                />
              </FormField>
            </Card>
          </div>

          <div className="lg:sticky lg:top-16 self-start">
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-[var(--color-neutral-1100)] mb-3">
                Live preview
              </h3>
              <style dangerouslySetInnerHTML={{ __html: previewCss }} />
              <div
                data-domain="preview"
                className="rounded-xl border border-[var(--color-border)] p-4 space-y-3"
                style={{ fontFamily: "var(--font-sans)" }}
              >
                <div className="flex items-center gap-2">
                  {tokens.brand.map((c, i) => (
                    <span
                      key={i}
                      className="h-6 flex-1 rounded"
                      style={{ background: c }}
                      title={c}
                    />
                  ))}
                </div>
                <button
                  className="px-3 py-1.5 text-sm font-medium text-[var(--color-on-accent)] w-full"
                  style={{
                    background: "var(--color-accent)",
                    borderRadius: "var(--radius-md)",
                  }}
                >
                  Primary action
                </button>
                <a
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  className="block text-sm"
                  style={{ color: "var(--color-accent)" }}
                >
                  A themed link
                </a>
                <div className="flex gap-2 text-xs">
                  <span style={{ color: "var(--color-ok)" }}>● Success</span>
                  <span style={{ color: "var(--color-warn)" }}>● Warning</span>
                  <span style={{ color: "var(--color-bad)" }}>● Danger</span>
                </div>
              </div>
              <p className="text-[11px] text-[var(--color-neutral-700)] mt-3">
                Accent, links, and focus rings across the console resolve through
                the brand ramp, so saving re-skins every page.
              </p>
            </Card>
          </div>
        </div>
      </PageBody>
    </>
  );
}

function ColorInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-10 shrink-0 cursor-pointer rounded border border-[var(--color-border)] bg-transparent p-0.5"
        aria-label="Pick color"
      />
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
