import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {};

// Sentry/GlitchTip integration. Source-map upload is skipped when
// SENTRY_AUTH_TOKEN is unset (which is fine for dev / UAT / self-hosted
// GlitchTip — we just get error reports without de-minified stack traces).
//
// For GlitchTip self-hosted, set the SENTRY_URL env var at build time —
// sentry-cli reads it directly to know where to upload source maps.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG ?? "korrali",
  project: process.env.SENTRY_PROJECT ?? "growth-web",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  telemetry: false,
  // Tunnel client-side errors via Next.js so ad-blockers don't kill them.
  tunnelRoute: "/monitoring/tunnel",
});
