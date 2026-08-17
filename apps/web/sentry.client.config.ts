import * as Sentry from '@sentry/nextjs';

const SENSITIVE_KEYS = ['password', 'token', 'accessToken', 'refreshToken', 'tcKimlik', 'tcNo', 'telefon', 'phone', 'creditCard', 'iban', 'secret'];

function scrubSensitiveData(data: Record<string, any> | undefined): Record<string, any> | undefined {
  if (!data || typeof data !== 'object') return data;
  const scrubbed = { ...data };
  for (const key of Object.keys(scrubbed)) {
    if (SENSITIVE_KEYS.some(s => key.toLowerCase().includes(s.toLowerCase()))) {
      scrubbed[key] = '[FILTERED]';
    } else if (typeof scrubbed[key] === 'object' && scrubbed[key] !== null) {
      scrubbed[key] = scrubSensitiveData(scrubbed[key]);
    }
  }
  return scrubbed;
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === 'production',

  // Performance
  tracesSampleRate: 0.1,

  // Session replay for error debugging
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0.5,

  // Integrations
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
  ],

  // Sensitive data scrubbing
  beforeSend(event) {
    if (event.request?.data) {
      event.request.data = scrubSensitiveData(event.request.data as Record<string, any>);
    }
    if (event.extra) {
      event.extra = scrubSensitiveData(event.extra as Record<string, any>);
    }
    return event;
  },

  // Filter noisy errors
  ignoreErrors: [
    'ResizeObserver loop',
    'Non-Error promise rejection',
    'AbortError',
    'NetworkError',
    'Load failed',
    'Failed to fetch',
  ],

  // Environment
  environment: process.env.NODE_ENV,
});
