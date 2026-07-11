import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { surfaceLight, surfaceDark } from "@justmail/design-tokens";
import { Providers } from "@/lib/query";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: {
    default: "JustMail Console",
    template: "%s · JustMail",
  },
  description: "JustMail admin console",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: surfaceLight.bg },
    { media: "(prefers-color-scheme: dark)", color: surfaceDark.bg },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="theme-light">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
