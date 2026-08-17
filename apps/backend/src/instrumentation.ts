// Sentry backend instrumentation
// This file is loaded before the NestJS app starts.
// Install: pnpm add @sentry/node --filter @sigorta/backend
// Uncomment and configure when SENTRY_DSN is set.

/*
import * as Sentry from '@sentry/node';

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
    integrations: [
      Sentry.httpIntegration(),
      Sentry.expressIntegration(),
    ],
  });
}

export { Sentry };
*/

export {};
