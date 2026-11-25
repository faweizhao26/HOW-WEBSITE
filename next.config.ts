import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.DOCKER_BUILD === "1" ? "standalone" : undefined,
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
