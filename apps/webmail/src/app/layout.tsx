import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Providers } from "@/lib/query";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: {
    default: "JustMail",
    template: "%s · JustMail",
  },
  description: "JustMail webmail",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "JustMail",
  },
};

export const viewport: Viewport = {
  themeColor: "#F7F8FA",
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
