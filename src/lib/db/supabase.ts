/**
 * Supabase clients.
 *
 * Status: SCAFFOLD. The migration at supabase/migrations/0001_initial_schema.sql
 * is ready to apply. These clients compile today and will be wired into
 * /api/memory and /api/auth routes in Day 4 once the Supabase project exists.
 *
 * Required env vars (all runtime-only; absent at build time is fine):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY (server only; bypasses RLS; never expose)
 *
 * Until then, `isSupabaseConfigured()` returns false and every call site
 * falls back to localStorage.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/**
 * Browser-safe client using the anon key. Respects RLS — only the
 * authenticated user's rows are visible.
 */
export function createBrowserSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: true, autoRefreshToken: true },
    },
  );
}

/**
 * Server-side client with the service-role key. Bypasses RLS — use only
 * inside trusted API routes that have already authenticated the caller.
 */
export function createServiceSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/**
 * Server-side client that acts AS a given user (forwards their JWT).
 * Respects RLS. Use in API routes where the user's auth token is known.
 */
export function createUserSupabase(accessToken: string): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
