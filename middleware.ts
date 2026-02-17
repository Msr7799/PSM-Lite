import createMiddleware from 'next-intl/middleware';
import { routing } from './src/i18n/routing';

export default createMiddleware(routing);

export const config = {
    // Match only internationalized pathnames
    matcher: ['/', '/(ar|en)/:path*'],
    // Skip middleware for static files and API routes
    unstable_allowDynamic: [
        '/node_modules/**',
    ],
};
