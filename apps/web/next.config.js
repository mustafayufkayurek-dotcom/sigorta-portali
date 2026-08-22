const path = require('path');
const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  transpilePackages: ['@sigorta/shared'],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@sigorta/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    };
    return config;
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Local same-origin /api → backend (CORS’suz panel doğrulama)
  async rewrites() {
    const backend = process.env.BACKEND_PROXY_URL || 'http://127.0.0.1:3000';
    return [
      {
        source: '/api/:path*',
        destination: `${backend}/api/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${backend}/uploads/:path*`,
      },
    ];
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
