import type { NextConfig } from "next";

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
};

export default config;
