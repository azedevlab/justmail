import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Providers } from "../lib/query";
import { ServiceWorker } from "../lib/sw-register";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "JustMail",
  description: "Self-hosted mail platform",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "JustMail",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0d10",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
        <ServiceWorker />
      </body>
    </html>
  );
}
