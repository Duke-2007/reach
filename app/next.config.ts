import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["wto-artwork-boundary-conscious.trycloudflare.com"],
  outputFileTracingIncludes: {
    "/*": ["./public/data/**"],
  },
};

export default nextConfig;
