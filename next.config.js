const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  transpilePackages: ['@sigorta/shared'],
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = withSentryConfig(nextConfig, {
  // Sentry webpack plugin options
  silent: true,
  org: process.env.SENTRY_ORG || '',
  project: process.env.SENTRY_PROJECT || '',
}, {
  // Sentry SDK options
  widenClientFileUpload: true,
  disableLogger: true,
  hideSourceMaps: true,
  tunnelRoute: '/monitoring',
});
