"use client";
import { Empty, PageBody, PageHeader } from "@justmail/shared-ui";
import { Puzzle } from "lucide-react";

export default function PluginsPage() {
  return (
    <>
      <PageHeader
        title="Plugins"
        description="Extend JustMail with signed, sandboxed plugins."
      />
      <PageBody>
        <Empty
          icon={<Puzzle size={22} />}
          title="No plugins installed"
          description="The marketplace opens in v1.1. Until then, sideload signed plugins with justmail plugin install."
        />
      </PageBody>
    </>
  );
}
