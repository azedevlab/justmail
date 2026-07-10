import type { NextConfig } from "next";

// Baseline hardening headers for every admin response. The admin console renders
// only first-party content, so the CSP is tight: no third-party origins, framing
// denied, and connect limited to same-origin plus HTTPS/WSS for the API + realtime.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https: wss:",
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
    "@justmail/theme-engine",
  ],
  experimental: {
    optimizePackageImports: ["lucide-react", "@justmail/shared-ui"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default config;
