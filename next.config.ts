import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  // Fix for Vercel middleware deployment issue
  experimental: {
    serverComponentsExternalPackages: ['next-intl'],
  },
  // Ensure middleware is properly traced
  outputFileTracing: true,
};

export default withNextIntl(nextConfig);
