import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@react-pdf/renderer", "canvas", "pdf-parse", "mammoth"],
};

export default withSentryConfig(nextConfig, {
  // Sentry org + project — set via SENTRY_ORG and SENTRY_PROJECT env vars,
  // or leave blank to skip source map upload (still captures errors at runtime).
  silent: true,            // suppress CLI output in CI
  disableLogger: true,
  automaticVercelMonitors: false,
  // Only upload source maps in CI/Vercel where SENTRY_AUTH_TOKEN is set.
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
  // Suppress the "Sentry SDK not configured" warning when DSN is absent locally.
  // Errors still captured at runtime when NEXT_PUBLIC_SENTRY_DSN is set.
});
