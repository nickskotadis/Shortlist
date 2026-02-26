import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@react-pdf/renderer", "canvas", "pdf-parse", "mammoth"],
};

export default nextConfig;
