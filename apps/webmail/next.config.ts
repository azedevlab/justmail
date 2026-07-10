import type { NextConfig } from "next";

// Webmail renders sender-supplied email HTML, so img/media may reference remote
// HTTPS origins (until the remote-content proxy lands). Scripts stay first-party;
// object/frame embedding from mail is blocked, and the app itself can't be framed.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https: wss:",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const config: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  transpilePackages: [
    "@justmail/contracts",
    "@justmail/design-tokens",
    "@justmail/shared-ui",
    "@justmail/shared-utils",
  ],
  experimental: {
    optimizePackageImports: ["lucide-react", "@justmail/shared-ui"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default config;
