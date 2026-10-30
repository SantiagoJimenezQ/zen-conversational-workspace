import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  devIndicators: false,
  env: {
    NEXT_PUBLIC_ZERNIO_MCP_MOCK:
      process.env.VERCEL === "1" || process.env.ZERNIO_MCP_MOCK !== "false"
        ? "true"
        : "false",
  },
  outputFileTracingRoot: __dirname,
};
export default nextConfig;
