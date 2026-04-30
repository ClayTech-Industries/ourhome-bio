/**
 * Cloud sync for OurHome — uploads localStorage state to Supabase
 * when the user is authenticated.
 *
 * This is "last write wins" with timestamp-based conflict resolution.
 */

import type { Home, Memory, MemoryObject } from "@/lib/schema";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface SyncState {
  home: Home;
  memories: Memory[];
  objects: MemoryObject[];
  lastSyncedAt: string;
}

export async function uploadState(
  supabase: SupabaseClient,
  state: Omit<SyncState, "lastSyncedAt">
): Promise<{ error?: string }> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { error: userError?.message ?? "Not authenticated" };
  }

  const payload = {
    user_id: user.id,
    home: state.home,
    memories: state.memories,
    objects: state.objects,
    last_synced_at: new Date().toISOString(),
  };

  // Upsert into user_home_state table
  const { error } = await supabase
    .from("user_home_state")
    .upsert(payload, { onConflict: "user_id" });

  if (error) {
    console.error("Sync upload failed:", error.message);
    return { error: error.message };
  }

  return {};
}

export async function downloadState(
  supabase: SupabaseClient
): Promise<SyncState | { error: string }> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { error: userError?.message ?? "Not authenticated" };
  }

  const { data, error } = await supabase
    .from("user_home_state")
    .select("home, memories, objects, last_synced_at")
    .eq("user_id", user.id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No data yet — not an error
      return { error: "No cloud state found" };
    }
    console.error("Sync download failed:", error.message);
    return { error: error.message };
  }

  return {
    home: data.home as Home,
    memories: (data.memories as Memory[]) ?? [],
    objects: (data.objects as MemoryObject[]) ?? [],
    lastSyncedAt: data.last_synced_at,
  };
}

/**
 * Trigger a background sync upload.
 * Call this after any mutation to localStorage.
 */
export async function syncUpload(
  supabase: SupabaseClient | null,
  getState: () => { home: Home; memories: Memory[]; objects: MemoryObject[] }
): Promise<void> {
  if (!supabase) return;

  // Debounce: wait 2 seconds after last change
  await new Promise((r) => setTimeout(r, 2000));

  const state = getState();
  const result = await uploadState(supabase, state);

  if (result.error) {
    console.warn("Background sync failed:", result.error);
  } else {
    console.log("Synced to cloud at", new Date().toISOString());
  }
}
