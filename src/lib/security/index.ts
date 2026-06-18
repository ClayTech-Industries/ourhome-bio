/**
 * Security utilities for OurHome.
 *
 * DR-006 Security Hardening:
 *   1. Strip internal identifiers from client-facing responses
 *   2. Environment isolation — detect prod secrets in dev mode
 *   3. Rate limiting helpers (per-IP, in-memory for Sprint 1)
 */

// -----------------------------------------------------------------
// Identifier stripping — remove internal IDs from client responses
// -----------------------------------------------------------------

/**
 * Fields to strip from memory objects before sending to client.
 * These are internal database identifiers that don't belong in the
 * client bundle or in HTML that could be inspected.
 */
const INTERNAL_FIELDS = [
  "r2_key",
  "owner_id",
  "home_id",
  "room_id",
  "service_role",
] as const;

/**
 * Recursively strip internal fields from an object or array.
 * Used before returning JSON responses to the client.
 */
export function stripInternal<T>(data: T): T {
  if (data === null || data === undefined) return data;
  if (typeof data !== "object") return data;
  if (Array.isArray(data)) return data.map(stripInternal) as T;

  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (INTERNAL_FIELDS.includes(key as (typeof INTERNAL_FIELDS)[number])) continue;
    cleaned[key] = stripInternal(value);
  }
  return cleaned as T;
}

// -----------------------------------------------------------------
// Environment isolation — detect prod secrets in dev mode
// -----------------------------------------------------------------

/**
 * Check if we're running in development mode.
 */
function isDevMode(): boolean {
  return process.env.NODE_ENV === "development";
}

/**
 * Detect potentially dangerous environment configurations.
 * Returns warnings that should be logged (not shown to user).
 */
export function checkEnvIsolation(): string[] {
  const warnings: string[] = [];

  if (isDevMode()) {
    // In dev mode, check for production-looking secrets
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceKey && serviceKey.length > 50 && !serviceKey.includes("test")) {
      warnings.push(
        "SUPABASE_SERVICE_ROLE_KEY looks like a production key in dev mode. " +
          "Ensure dev uses a separate Supabase project or test keys.",
      );
    }

    // Check for production URLs in dev
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (supabaseUrl && !supabaseUrl.includes("localhost") && !supabaseUrl.includes("127.0.0.1")) {
      warnings.push(
        `NEXT_PUBLIC_SUPABASE_URL points to ${supabaseUrl} in dev mode. ` +
          "Consider using a local Supabase instance for development.",
      );
    }
  }

  // Always check: RELAY_SECRET must not be empty or a known weak value
  const relaySecret = process.env.RELAY_SECRET;
  if (relaySecret) {
    const weakSecrets = ["nova", "password", "secret", "changeme", "test", "1234"];
    if (weakSecrets.includes(relaySecret.toLowerCase())) {
      warnings.push(
        `RELAY_SECRET is set to a weak value ("${relaySecret}"). ` +
          "Use a strong random secret: openssl rand -hex 32",
      );
    }
    if (relaySecret.length < 16) {
      warnings.push(
        `RELAY_SECRET is only ${relaySecret.length} characters. ` +
          "Minimum 16 characters recommended, 32 preferred.",
      );
    }
  }

  // Check: API keys should not be exposed to client
  // NEXT_PUBLIC_ vars are visible in client bundles
  const dangerousPublicVars = [
    "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_ANTHROPIC_API_KEY",
    "NEXT_PUBLIC_OPENAI_API_KEY",
    "NEXT_PUBLIC_R2_SECRET_ACCESS_KEY",
  ];
  for (const varName of dangerousPublicVars) {
    if (process.env[varName]) {
      warnings.push(
        `${varName} is set — this will be exposed in the client bundle! ` +
          "Remove the NEXT_PUBLIC_ prefix from this variable.",
      );
    }
  }

  return warnings;
}

/**
 * Log environment warnings at startup.
 * Called from the server initialization.
 */
export function logEnvWarnings(): void {
  const warnings = checkEnvIsolation();
  for (const w of warnings) {
    console.warn(`[OurHome Security] ${w}`);
  }
}

// -----------------------------------------------------------------
// Rate limiting — in-memory per-IP for Sprint 1
// -----------------------------------------------------------------

interface RateBucket {
  count: number;
  resetAt: number;
}

const rateBuckets = new Map<string, RateBucket>();
const RATE_WINDOW_MS = 60_000; // 1 minute
const RATE_MAX_REQUESTS = 30; // 30 requests per minute per IP

/**
 * Check if an IP has exceeded the rate limit.
 * Returns true if the request should be allowed, false if blocked.
 * In-memory only — resets on server restart. For production, use Upstash Redis.
 */
export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(ip);

  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }

  bucket.count++;
  return bucket.count <= RATE_MAX_REQUESTS;
}

/**
 * Get the client IP from a request, accounting for proxies.
 */
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIP = request.headers.get("x-real-ip");
  if (realIP) return realIP;
  return "unknown";
}