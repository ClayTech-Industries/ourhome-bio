/**
 * SSR-safe Supabase clients for Next.js App Router.
 *
 * Uses @supabase/ssr for cookie-based session management.
 */

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/**
 * Creates a Supabase client for Server Components, Server Actions, and Route Handlers.
 * Automatically handles cookie reading/writing for session persistence.
 */
export async function createClient() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase not configured");
  }

  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  );
}

/**
 * Get the current user session (null if not authenticated).
 * Safe to call from any server context.
 */
export async function getSession() {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    console.error("Auth session error:", error.message);
    return null;
  }
  return session;
}

/**
 * Get the current authenticated user (null if not authenticated).
 */
export async function getUser() {
  const session = await getSession();
  return session?.user ?? null;
}
