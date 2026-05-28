// Sentry server-side config — catches errors in Server Components, Route
// Handlers, server actions. Works with GlitchTip (Sentry-compatible).

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "production",
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    // Don't report aborted requests as errors.
    ignoreErrors: ["AbortError", "NEXT_REDIRECT", "NEXT_NOT_FOUND"],
  });
}
