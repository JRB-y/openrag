import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Avoid Next misdetecting the workspace root when an unrelated
  // lockfile exists elsewhere on the machine (e.g. in the home dir).
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
};

export default nextConfig;
