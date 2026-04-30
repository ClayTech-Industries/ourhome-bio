# Supabase Auth Setup

## Overview
Sprint 1 Day 4 adds **authentication** to OurHome.bio, allowing users to:
- Sign in via GitHub, Google, or email magic link
- Sync their home state to the cloud
- Access their home from multiple devices
- Own their data (GDPR-compliant, exportable)

## Required Environment Variables

Add to `.env.local`:

```bash
# Supabase Project URL (found in Settings > API)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co

# Supabase Anon Key (public, safe to expose)
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...

# Supabase Service Role Key (server only, never expose to client)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...
```

## Setup Steps

### 1. Create Supabase Project
1. Go to [supabase.com](https://supabase.com) and create a project
2. Note your project URL and anon key from Settings > API
3. Copy the service role key (keep this secret!)

### 2. Configure Auth Providers
In Supabase Dashboard:

**GitHub OAuth:**
1. Authentication > Providers > GitHub
2. Enable GitHub
3. Create a [GitHub OAuth App](https://github.com/settings/developers)
   - Authorization callback URL: `https://your-project.supabase.co/auth/v1/callback`
   - Copy Client ID and Secret to Supabase

**Google OAuth:**
1. Authentication > Providers > Google
2. Enable Google
3. Create credentials in [Google Cloud Console](https://console.cloud.google.com/)
   - Add redirect URI: `https://your-project.supabase.co/auth/v1/callback`

**Email (Magic Link):**
- Already enabled by default, just configure email templates in Auth > Email Templates

### 3. Apply Database Schema

Run the migration in `supabase/migrations/0001_initial_schema.sql` either:
- Via Supabase Dashboard SQL Editor
- Or using Supabase CLI: `supabase db reset`

This creates:
- `profiles` table (extends auth.users)
- `homes`, `rooms`, `companions` tables
- `memories` table with pgvector for embeddings
- `user_home_state` table for cloud sync
- RLS policies for security

### 4. Test Locally

```bash
# Add env vars to .env.local
echo "NEXT_PUBLIC_SUPABASE_URL=https://..." >> .env.local
echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ..." >> .env.local

# Install packages when network is available
npm install @supabase/supabase-js @supabase/ssr

# Run dev server
npm run dev
```

Visit `http://localhost:3000/login` and test:
- [ ] GitHub OAuth login
- [ ] Google OAuth login  
- [ ] Email magic link login
- [ ] Logout returns to home
- [ ] Home state persists across reloads

### 5. Deploy to Vercel

Add environment variables in Vercel Dashboard:
- Project Settings > Environment Variables
- Add all three Supabase vars
- Redeploy

## Architecture

### Auth Flow
```
/login page → OAuth/Magic Link → Supabase Auth
     ↓
/auth/callback → Exchange code for session
     ↓
Middleware refreshes session on each request
     ↓
HomeExperience shows user avatar + logout
```

### Cloud Sync
When user is logged in:
1. Every localStorage mutation triggers debounced upload
2. `user_home_state` table stores JSON snapshot
3. On login, optionally restore from cloud (future feature)
4. RLS ensures users can only access their own data

### Security
- All database tables have Row Level Security (RLS)
- `user_home_state` policy: `auth.uid() = user_id`
- Service role key bypasses RLS for admin operations (never expose)
- Anon key is safe to expose, respects RLS

## Troubleshooting

**"Supabase not configured" message:**
- Check env vars are loaded: `console.log(process.env.NEXT_PUBLIC_SUPABASE_URL)`
- Restart dev server after adding env vars

**Auth callback fails:**
- Verify redirect URI in OAuth app matches Supabase callback URL exactly
- Check `auth/callback` route logs

**Database errors:**
- Ensure migrations applied: check Supabase Table Editor
- Verify RLS policies are enabled

## Next Steps

Once auth is working:
1. Enable cloud sync for existing local users (prompt on login)
2. Add memory search with pgvector
3. Add real-time collaboration (Supabase Realtime)
4. Set up R2 for markdown file storage
