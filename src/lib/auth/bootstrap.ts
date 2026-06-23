/**
 * Auth Bootstrap — provision home + companion + rooms in Supabase
 * after first authentication.
 *
 * Flow (BUILD_PLAN Priority 4):
 *   1. User authenticates via Supabase Auth (GitHub, Google, or magic link)
 *   2. /auth/callback exchanges code for session
 *   3. bootstrapNewHome() checks if user already has a home
 *   4. If no home exists → create companion + home + rooms from localStorage state
 *   5. If home exists → download cloud state and replace localStorage
 *
 * Design decisions:
 *   - Profile auto-creation trigger already exists in migration ✅
 *   - localStorage → cloud sync on first auth (preserves local work)
 *   - If user already has a cloud home, cloud wins (don't overwrite)
 *   - Graceful degradation: if Supabase isn't configured, everything stays local
 */

import { createServiceSupabase, isSupabaseConfigured } from "@/lib/db/supabase";
import type { Companion, Home, Memory, MemoryObject, Room } from "@/lib/schema";

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

export interface BootstrapResult {
  created: boolean;
  homeId: string | null;
  companionId: string | null;
  roomIds: string[];
  error: string | null;
}

export interface CloudStateResult {
  home: Home | null;
  rooms: Room[];
  memories: Memory[];
  objects: MemoryObject[];
  error: string | null;
}

// -----------------------------------------------------------------
// Check if user already has a home in the cloud
// -----------------------------------------------------------------

export async function userHasCloudHome(userId: string): Promise<boolean> {
  const supabase = createServiceSupabase();
  if (!supabase || !isSupabaseConfigured()) return false;

  try {
    const { data, error } = await supabase
      .from("homes")
      .select("id")
      .eq("owner_id", userId)
      .limit(1);

    if (error) {
      console.error("Check cloud home error:", error.message);
      return false;
    }

    return (data?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

// -----------------------------------------------------------------
// Bootstrap: create home + companion + rooms in Supabase
// -----------------------------------------------------------------

/**
 * Create a new home in the cloud from localStorage state.
 * Called after first authentication when no cloud home exists.
 *
 * This preserves the user's local work — their companion name, room colors,
 * memories — by pushing them to Supabase on first auth.
 */
export async function bootstrapNewHome(
  userId: string,
  localHome: Home,
  localRooms: Room[],
  localMemories: Memory[] = [],
  localObjects: MemoryObject[] = [],
): Promise<BootstrapResult> {
  const supabase = createServiceSupabase();
  if (!supabase || !isSupabaseConfigured()) {
    return {
      created: false,
      homeId: null,
      companionId: null,
      roomIds: [],
      error: "Supabase not configured",
    };
  }

  const roomIds: string[] = [];

  try {
    // 1. Create companion
    let { data: companionRow, error: companionError } = await supabase
      .from("companions")
      .insert({
        id: localHome.companion.id,
        owner_id: userId,
        name: localHome.companion.name,
        pronouns: localHome.companion.pronouns,
        voice_id: localHome.companion.voiceId,
        personality: localHome.companion.personality,
        created_at: localHome.companion.createdAt,
      })
      .select("id")
      .single();

    if (companionError) {
      // Companion might already exist (retry scenario) — try upsert
      const { data: upserted, error: upsertError } = await supabase
        .from("companions")
        .upsert({
          id: localHome.companion.id,
          owner_id: userId,
          name: localHome.companion.name,
          pronouns: localHome.companion.pronouns,
          voice_id: localHome.companion.voiceId,
          personality: localHome.companion.personality,
          created_at: localHome.companion.createdAt,
        }, { onConflict: "id" })
        .select("id")
        .single();

      if (upsertError) {
        return {
          created: false,
          homeId: null,
          companionId: null,
          roomIds: [],
          error: `Companion creation failed: ${upsertError.message}`,
        };
      }
      companionRow = upserted;
    }

    const companionId = companionRow?.id ?? localHome.companion.id;

    // 2. Create home
    let { data: homeRow, error: homeError } = await supabase
      .from("homes")
      .insert({
        id: localHome.id,
        owner_id: userId,
        companion_id: companionId,
        name: localHome.name ?? null,
        style_profile: localHome.styleProfile,
        season: localHome.season,
        created_at: localHome.createdAt,
      })
      .select("id")
      .single();

    if (homeError) {
      // Try upsert (retry scenario)
      const { data: upserted, error: upsertError } = await supabase
        .from("homes")
        .upsert({
          id: localHome.id,
          owner_id: userId,
          companion_id: companionId,
          name: localHome.name ?? null,
          style_profile: localHome.styleProfile,
          season: localHome.season,
          created_at: localHome.createdAt,
        }, { onConflict: "id" })
        .select("id")
        .single();

      if (upsertError) {
        return {
          created: false,
          homeId: null,
          companionId,
          roomIds: [],
          error: `Home creation failed: ${upsertError.message}`,
        };
      }
      homeRow = upserted;
    }

    const homeId = homeRow?.id ?? localHome.id;

    // 3. Create rooms
    for (const room of localRooms) {
      const { data: roomRow, error: roomError } = await supabase
        .from("rooms")
        .insert({
          id: room.id,
          home_id: homeId,
          slug: room.slug,
          name: room.name,
          type: room.type,
          wall_colors: room.wallColors,
          lighting: room.lighting,
          unlocked: room.unlocked,
          created_at: room.createdAt,
        })
        .select("id")
        .single();

      if (roomError) {
        // Try upsert
        const { data: upserted } = await supabase
          .from("rooms")
          .upsert({
            id: room.id,
            home_id: homeId,
            slug: room.slug,
            name: room.name,
            type: room.type,
            wall_colors: room.wallColors,
            lighting: room.lighting,
            unlocked: room.unlocked,
            created_at: room.createdAt,
          }, { onConflict: "id" })
          .select("id")
          .single();

        roomIds.push(upserted?.id ?? room.id);
      } else {
        roomIds.push(roomRow?.id ?? room.id);
      }
    }

    // 4. Sync memories via user_home_state (bulk JSON backup)
    // Individual memory rows are written by the capture pipeline (DR-009)
    // This is the bulk sync for existing localStorage memories
    if (localMemories.length > 0) {
      const { error: syncError } = await supabase
        .from("user_home_state")
        .upsert({
          user_id: userId,
          home: localHome,
          memories: localMemories,
          objects: localObjects,
          last_synced_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

      if (syncError) {
        console.error("Bulk memory sync error:", syncError.message);
        // Not fatal — home is created, memories can sync later
      }
    }

    return {
      created: true,
      homeId,
      companionId,
      roomIds,
      error: null,
    };
  } catch (error) {
    console.error("Bootstrap failed:", error);
    return {
      created: false,
      homeId: null,
      companionId: null,
      roomIds: [],
      error: error instanceof Error ? error.message : "Bootstrap failed",
    };
  }
}

// -----------------------------------------------------------------
// Download cloud state (for returning users)
// -----------------------------------------------------------------

/**
 * Download the user's home state from Supabase.
 * Called when a user logs in and already has a cloud home.
 * Cloud state wins — replaces localStorage.
 */
export async function downloadCloudState(userId: string): Promise<CloudStateResult> {
  const supabase = createServiceSupabase();
  if (!supabase || !isSupabaseConfigured()) {
    return {
      home: null,
      rooms: [],
      memories: [],
      objects: [],
      error: "Supabase not configured",
    };
  }

  try {
    // Fetch home
    const { data: homeData, error: homeError } = await supabase
      .from("homes")
      .select(`
        id, name, style_profile, season, created_at,
        human_avatar_url, human_avatar_description, packed_items,
        companion:companions(id, name, pronouns, voice_id, avatar_url, avatar_description, personality, created_at)
      `)
      .eq("owner_id", userId)
      .single();

    if (homeError || !homeData) {
      return {
        home: null,
        rooms: [],
        memories: [],
        objects: [],
        error: homeError?.message ?? "No home found",
      };
    }

    // Fetch rooms
    const { data: roomData, error: roomError } = await supabase
      .from("rooms")
      .select("id, slug, name, type, wall_colors, lighting, unlocked, created_at")
      .eq("home_id", homeData.id);

    if (roomError) {
      console.error("Room fetch error:", roomError.message);
    }

    // Fetch memories from bulk state backup
    const { data: stateData } = await supabase
      .from("user_home_state")
      .select("home, memories, objects, last_synced_at")
      .eq("user_id", userId)
      .single();

    // Reconstruct Home object
    const companionData = homeData.companion as any;
    const home: Home = {
      id: homeData.id,
      name: homeData.name ?? undefined,
      companion: {
        id: companionData?.id ?? "",
        name: companionData?.name ?? "Companion",
        pronouns: companionData?.pronouns ?? "they/them",
        voiceId: companionData?.voice_id ?? null,
        avatarUrl: companionData?.avatar_url ?? null,
        avatarDescription: companionData?.avatar_description ?? null,
        personality: companionData?.personality ?? { traits: [], locked: true },
        createdAt: companionData?.created_at ?? homeData.created_at,
      },
      humanAvatarUrl: homeData.human_avatar_url ?? null,
      humanAvatarDescription: homeData.human_avatar_description ?? null,
      packedItems: homeData.packed_items ?? [],
      styleProfile: homeData.style_profile ?? { colorPalette: [], aestheticTags: [] },
      season: homeData.season ?? "autumn",
      createdAt: homeData.created_at,
    };

    const rooms: Room[] = (roomData ?? []).map((r: any) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      type: r.type,
      wallColors: r.wall_colors ?? {},
      lighting: r.lighting ?? { preset: "afternoon", intensity: 1 },
      unlocked: r.unlocked ?? true,
      createdAt: r.created_at,
    }));

    const memories = (stateData?.memories as Memory[]) ?? [];
    const objects = (stateData?.objects as MemoryObject[]) ?? [];

    return {
      home,
      rooms,
      memories,
      objects,
      error: null,
    };
  } catch (error) {
    console.error("Cloud state download failed:", error);
    return {
      home: null,
      rooms: [],
      memories: [],
      objects: [],
      error: error instanceof Error ? error.message : "Download failed",
    };
  }
}