"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/db/supabase";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [supabase] = useState(() => createBrowserSupabase());

  // Check if already logged in
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        window.location.href = "/";
      }
    });
  }, [supabase]);

  const handleOAuth = async (provider: "github" | "google") => {
    if (!supabase) {
      setMessage("Supabase not configured");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setMessage(error.message);
      setLoading(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setMessage("Supabase not configured");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Check your email for the magic link!");
    }
    setLoading(false);
  };

  const isConfigured = Boolean(supabase);

  return (
    <main className="min-h-screen bg-[#1a1814] text-[#f5f0e6] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-light tracking-[0.12em] text-[#c9a87c]">
            Welcome Home
          </h1>
          <p className="text-[#f5f0e6]/50 text-sm tracking-wide">
            Sign in to sync your memories across devices
          </p>
        </div>

        {!isConfigured && (
          <div className="bg-[#c9a87c]/10 border border-[#c9a87c]/30 rounded-lg p-4 text-center">
            <p className="text-[#f5f0e6]/70 text-sm">
              Auth not configured. You can still use OurHome locally.
            </p>
            <Link
              href="/"
              className="inline-block mt-3 text-[#c9a87c] text-sm hover:underline"
            >
              Continue without account →
            </Link>
          </div>
        )}

        {isConfigured && (
          <>
            {/* OAuth Buttons */}
            <div className="space-y-3">
              <button
                onClick={() => handleOAuth("github")}
                disabled={loading}
                className="w-full py-3 px-4 bg-[#c9a87c]/20 hover:bg-[#c9a87c]/30 disabled:opacity-50 border border-[#c9a87c]/50 rounded-lg transition-colors flex items-center justify-center gap-3 text-sm tracking-wide"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                Continue with GitHub
              </button>

              <button
                onClick={() => handleOAuth("google")}
                disabled={loading}
                className="w-full py-3 px-4 bg-[#c9a87c]/20 hover:bg-[#c9a87c]/30 disabled:opacity-50 border border-[#c9a87c]/50 rounded-lg transition-colors flex items-center justify-center gap-3 text-sm tracking-wide"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.85 2.97c.87-2.6 3.3-4.66 6.16-4.66z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>
            </div>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#c9a87c]/20" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-[#1a1814] text-[#f5f0e6]/40">or</span>
              </div>
            </div>

            {/* Magic Link */}
            <form onSubmit={handleMagicLink} className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                className="w-full px-4 py-3 bg-[#0d0b09] border border-[#c9a87c]/30 rounded-lg text-[#f5f0e6] placeholder-[#f5f0e6]/30 text-sm focus:outline-none focus:border-[#c9a87c] transition-colors"
              />
              <button
                type="submit"
                disabled={loading || !email}
                className="w-full py-3 px-4 bg-[#c9a87c] hover:bg-[#b89a6f] disabled:opacity-50 disabled:hover:bg-[#c9a87c] text-[#1a1814] font-medium rounded-lg transition-colors text-sm tracking-wide"
              >
                {loading ? "Sending..." : "Send magic link"}
              </button>
            </form>
          </>
        )}

        {/* Message */}
        {message && (
          <div className={`p-4 rounded-lg text-sm ${
            message.includes("Check your email")
              ? "bg-green-500/10 text-green-400 border border-green-500/30"
              : "bg-red-500/10 text-red-400 border border-red-500/30"
          }`}>
            {message}
          </div>
        )}

        {/* Back link */}
        <div className="text-center">
          <Link
            href="/"
            className="text-[#f5f0e6]/40 hover:text-[#f5f0e6]/70 text-sm transition-colors"
          >
            ← Back to your home
          </Link>
        </div>
      </div>
    </main>
  );
}
