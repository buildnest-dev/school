import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Pin the workspace root to this project (a stray lockfile in a parent folder can confuse detection).
  turbopack: { root: path.resolve(process.cwd()) },
};

export default nextConfig;
