import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // The Docker image runs this server. Vercel uses Dockerfile.vercel, not the serverless build.
  output: "standalone",
  serverExternalPackages: ["@cursor/sdk", "@mysten-incubation/memwal"],
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/@cursor/sdk/**/*",
      "./node_modules/@mysten-incubation/memwal/**/*",
      "./node_modules/@mysten/seal/**/*",
      "./node_modules/@mysten/sui/**/*",
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
