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
  // (Though matcher helps, explicit check is safe)
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.match(/\.(png|jpg|jpeg|gif|svg|css|js|woff|woff2|ttf|eot)$/)
  ) {
    return intlMiddleware(request); // Or NextResponse.next() if intl shouldn't run on assets
  }

  const isLoginPage = pathname.includes('/login');
  const isAuthenticated = await verifyAuth(request);

  // Helper to determine locale or default
  const localeMatch = pathname.match(/^\/(ar|en)/);
  const locale = localeMatch ? localeMatch[1] : 'ar'; // Default to arabic if unknown? Or 'en'. routing.ts says default is en. Let's use 'ar' as fallback for user preference or match routing.

  // 1. If NOT authenticated and trying to access protected route (anything not login)
  if (!isAuthenticated && !isLoginPage) {
    const loginUrl = new URL(`/${locale}/login`, request.url);
    return NextResponse.redirect(loginUrl);
  }

  // 2. If authenticated and trying to access login page
  if (isAuthenticated && isLoginPage) {
    // Redirect to home or dashboard
    const dashboardUrl = new URL(`/${locale}`, request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  // 3. Continue with intl middleware
  return intlMiddleware(request);
}

export const config = {
  // Match all paths except api, _next, static files
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
};
