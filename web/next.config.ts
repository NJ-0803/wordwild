import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // The learning core lives in ../core (pure TypeScript, shared with any future client).
  turbopack: { root: path.resolve(__dirname, "..") },
};

export default nextConfig;
