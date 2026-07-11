import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { surfaceLight, surfaceDark } from "@justmail/design-tokens";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@justmail/shared-ui";
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: surfaceLight.bg },
    { media: "(prefers-color-scheme: dark)", color: surfaceDark.bg },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="theme-light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>
          <Providers>{children}</Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
