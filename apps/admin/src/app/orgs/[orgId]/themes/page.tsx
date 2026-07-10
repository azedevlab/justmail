"use client";
import { Empty, PageBody, PageHeader } from "@justmail/shared-ui";
import { Palette } from "lucide-react";

export default function ThemesPage() {
  return (
    <>
      <PageHeader
        title="Themes"
        description="Brand the console, webmail, and login pages per organization or per domain."
      />
      <PageBody>
        <Empty
          icon={<Palette size={22} />}
          title="Using the default theme"
          description="Custom themes edit color, fonts, and radius tokens; save one to override this org's look."
        />
      </PageBody>
    </>
  );
}
