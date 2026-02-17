import createMiddleware from 'next-intl/middleware';
import { routing } from './src/i18n/routing';
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const intlMiddleware = createMiddleware(routing);

const SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || "your-secret-key-change-in-production"
);

async function verifyAuth(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get('auth_token')?.value;
  
  if (!token) {
    return false;
  }

  try {
    await jwtVerify(token, SECRET_KEY);
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip auth check for API routes, static files, and _next
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.match(/\.(png|jpg|jpeg|gif|svg|css|js|woff|woff2|ttf|eot)$/)
  ) {
    return intlMiddleware(request);
  }

  // Check if accessing login page
  const isLoginPage = pathname.includes('/login');

  // Verify authentication
  const isAuthenticated = await verifyAuth(request);

  // If not authenticated and not on login page, redirect to login
  if (!isAuthenticated && !isLoginPage) {
    const locale = pathname.split('/')[1] || 'ar';
    const loginUrl = new URL(`/${locale}/login`, request.url);
    return NextResponse.redirect(loginUrl);
  }

  // If authenticated and on login page, redirect to dashboard
  if (isAuthenticated && isLoginPage) {
    const locale = pathname.split('/')[1] || 'ar';
    const dashboardUrl = new URL(`/${locale}/dashboard`, request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  // Continue with next-intl middleware and pass pathname header
  const response = intlMiddleware(request);
  response.headers.set('x-next-pathname', pathname);
  return response;
}

export const config = {
    // Match only internationalized pathnames
    matcher: ['/', '/(ar|en)/:path*'],
    // Skip middleware for static files and API routes
    unstable_allowDynamic: [
        '/node_modules/**',
    ],
};
