import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Files read at runtime with fs (rules + services for Gemini; never pricing.md).
  outputFileTracingIncludes: {
    "/api/**": ["./config/qualification_rules.md", "./knowledge/services.md"],
    "/dashboard/**": ["./config/qualification_rules.md", "./knowledge/services.md"],
  },
};

export default nextConfig;
