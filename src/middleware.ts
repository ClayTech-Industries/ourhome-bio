/**
 * Next.js Middleware — session protection and route gating.
 *
 * Per BUILD_PLAN Priority 5 and ARCHITECTURE.md vulnerable builds:
 *   - /home/* requires authenticated session (when Supabase configured)
 *   - /api/conversation, /api/export require session (when configured)
 *   - /api/send requires RELAY_SECRET (handled in route, not here)
 *   - Public routes: /, /login, /auth/callback, /about
 *
 * When Supabase is NOT configured, middleware is a pass-through.
 * Local-first mode: the app works without auth, everything in localStorage.
 */

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Routes that require authentication (when Supabase is configured)
const PROTECTED_ROUTES = ["/home"];
const PROTECTED_API = ["/api/conversation", "/api/export"];

// Routes that are always public
const PUBLIC_ROUTES = ["/", "/login", "/auth/callback", "/about"];

function isProtectedRoute(pathname: string): boolean {
  if (PROTECTED_ROUTES.some((r) => pathname.startsWith(r))) return true;
  if (PROTECTED_API.some((r) => pathname.startsWith(r))) return true;
  return false;
}

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"));
}

// Static asset matcher — skip everything below
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|map)$).*)",
  ],
};

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase not configured, pass through (local-first mode)
  if (!url || !key) {
    return NextResponse.next();
  }

  // Dev mode: skip auth protection for easy local testing
  if (process.env.NODE_ENV === "development") {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  // Public routes pass through
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Only check auth on protected routes
  if (!isProtectedRoute(pathname)) {
    return NextResponse.next();
  }

  // Check for Supabase session cookies
  // Supabase SSR sets these cookies: sb-<ref>-auth-token
  const authCookie = request.cookies
    .getAll()
    .find((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));

  if (!authCookie?.value) {
    // No session — redirect to login for pages, 401 for API
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Session cookie exists — refresh it and pass through
  // The actual session validation happens in the route handler via
  // supabase-server.ts createClient(). Middleware just checks cookie presence
  // and refreshes the token if needed.
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Create a Supabase client to refresh the session
  const supabase = createServerClient(url, key, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        response.cookies.set({ name, value: "", ...options });
      },
    },
  });

  // Refresh session (no await needed — runs in background)
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (!session) {
      // Session invalid — but we already passed through.
      // The route handler will catch this with its own auth check.
      // Middleware shouldn't block here to avoid race conditions.
    }
  });

  return response;
}