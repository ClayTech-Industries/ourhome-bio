/**
 * Verify Supabase connection and check schema.
 * Run: node scripts/verify-supabase.js
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Try service role first (bypasses RLS), then fall back to anon
const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function verify() {
  console.log('Connecting to:', url);
  console.log('Key format:', serviceKey.substring(0, 12) + '...');
  console.log('');

  // Check each table exists by attempting a select
  // Each table has a different primary key column
  const tables = [
    { name: 'profiles', pk: 'id' },
    { name: 'companions', pk: 'id' },
    { name: 'homes', pk: 'id' },
    { name: 'rooms', pk: 'id' },
    { name: 'memories', pk: 'id' },
    { name: 'memory_objects', pk: 'id' },
    { name: 'room_state_history', pk: 'id' },
    { name: 'conversation_turns', pk: 'id' },
    { name: 'user_home_state', pk: 'user_id' },
  ];

  let allGood = true;
  for (const table of tables) {
    const { error } = await supabase
      .from(table.name)
      .select(table.pk)
      .limit(1);
    if (error) {
      console.log(`  ❌ ${table.name} — ${error.message}`);
      allGood = false;
    } else {
      console.log(`  ✅ ${table.name}`);
    }
  }

  console.log('');
  if (allGood) {
    console.log('🎉 Supabase schema verified — all 9 tables accessible');
  } else {
    console.log('⚠️  Some tables inaccessible — checking via REST API directly...');
    
    // Try direct REST call with service role header
    const restUrl = `${url}/rest/v1/profiles?select=id&limit=1`;
    try {
      const res = await fetch(restUrl, {
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
      });
      const text = await res.text();
      console.log(`  REST API response (${res.status}): ${text.substring(0, 200)}`);
    } catch (e) {
      console.log(`  REST API error: ${e.message}`);
    }
  }
}

verify().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});