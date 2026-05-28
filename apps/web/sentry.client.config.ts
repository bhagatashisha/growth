// Sentry client-side config. Works with GlitchTip too (self-hosted Sentry-
// compatible). DSN is set via NEXT_PUBLIC_SENTRY_DSN at build time.
//
// In production, the DSN points at our self-hosted GlitchTip on EC2:
//   https://<glitchtip-public-dsn>@glitchtip.korrali.com/<project-id>
//
// When SENTRY_DSN is unset (e.g., dev/UAT), Sentry initializes as no-op.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV ?? "production",
    // Capture 10% of routine transactions, 100% of errors. Tunable later.
    tracesSampleRate: 0.1,
    // Replay 0% of normal sessions, 100% of error sessions — for debugging hard cases.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    // Don't capture PII automatically.
    sendDefaultPii: false,
  });
}
