import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse } from "next/server";

/**
 * OAuth callback route.
 *
 * After Supabase exchanges the code for a session, we:
 *   1. Get the authenticated user
 *   2. Check if they already have a cloud home (userHasCloudHome)
 *   3. If no cloud home → bootstrap from localStorage state
 *   4. If cloud home exists → redirect to home (client will download cloud state)
 *
 * The bootstrap runs server-side using the service-role client.
 * The client-side HomeExperience handles localStorage → cloud sync
 * and cloud → localStorage download on auth state change.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return NextResponse.redirect(`${origin}/login?error=not_configured`);
  }

  const response = NextResponse.redirect(`${origin}${next}`);

  const supabase = createServerClient(url, key, {
    cookies: {
      get(name: string) {
        // Get from request headers
        const cookie = request.headers
          .get("cookie")
          ?.split(";")
          .find((c) => c.trim().startsWith(`${name}=`));
        return cookie?.split("=")[1];
      },
      set(name: string, value: string, options: CookieOptions) {
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        response.cookies.set({ name, value: "", ...options });
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("Auth callback error:", error.message);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`
    );
  }

  // Get the authenticated user
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    // Check if user already has a cloud home
    try {
      const { userHasCloudHome, bootstrapNewHome } = await import("@/lib/auth/bootstrap");
      const hasHome = await userHasCloudHome(user.id);

      if (!hasHome) {
        // No cloud home yet — this is a first-time user
        // The client-side HomeExperience will detect auth state change
        // and trigger the bootstrap from localStorage.
        // We pass a flag via the redirect URL so the client knows to bootstrap.
        const bootstrapUrl = new URL(`${origin}${next}`);
        bootstrapUrl.searchParams.set("bootstrap", "true");
        return NextResponse.redirect(bootstrapUrl.toString());
      }
    } catch (bootstrapError) {
      // Bootstrap check failed — not fatal, user can still use the app
      console.error("Bootstrap check failed:", bootstrapError);
    }
  }

  return response;
}
