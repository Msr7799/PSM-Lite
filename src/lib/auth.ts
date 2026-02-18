import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

const SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || "your-secret-key-change-in-production"
);

const COOKIE_NAME = "auth_token";

// Hardcoded credentials
const ADMIN_EMAIL = "admin@admin.com";
const ADMIN_PASSWORD = "admin";

export async function validateCredentials(email: string, password: string): Promise<boolean> {
  return email === ADMIN_EMAIL && password === ADMIN_PASSWORD;
}

export async function createSession(email: string): Promise<string> {
  const token = await new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(SECRET_KEY);

  return token;
}

export async function setAuthCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });
}

export async function clearAuthCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function verifyToken(token: string): Promise<{ email: string } | null> {
  if (!token) return null;
  try {
    const verified = await jwtVerify(token, SECRET_KEY);
    return verified.payload as { email: string };
  } catch {
    return null;
  }
}

export async function verifySession(): Promise<{ email: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return verifyToken(token);
}

// Helper to get session from request (supports API Key for mobile app)
export async function getServerSession(req: NextRequest): Promise<{ email: string } | null> {
  // 1. Check API Key (Bypass for Mobile App)
  const apiKey = req.headers.get("x-api-key");
  const validApiKey = process.env.API_KEY || "pms-lite-secret-api-key"; // Fallback for dev

  if (apiKey === validApiKey) {
    return { email: "mobile-app@pms.local" };
  }

  // 2. Check Cookie
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;

  return verifyToken(token);
}
