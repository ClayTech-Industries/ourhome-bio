"use client";

/**
 * The home experience — Living Room + Memory Wall + Chat, all client-side
 * for Day 1/2. Home state persists in localStorage.
 *
 * Wires up:
 *  - capture_memory tool → place frame on wall
 *  - change_wall_color tool → animate wall transition
 *  - frame click → dispatches a silent "looking at <title>" turn that
 *    triggers a recall in-character
 *  - export → downloads a ZIP of markdown memories
 *  - auth → Supabase user session (when configured)
 *  - presence → companion state (thinking, speaking, etc.) drives room
 *    environmental changes per Principle 2 & 3
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SceneCanvas } from "@/components/scene/SceneCanvas";
import { LivingRoom } from "@/components/scene/LivingRoom";
import { Kitchen } from "@/components/scene/Kitchen";
import { MemoryDetailPanel } from "@/components/MemoryDetailPanel";
import { ChatPanel, type ChatPanelHandle, type ChatTurn } from "@/components/chat/ChatPanel";
import type {
  CaptureMemoryArgs,
  ChangeWallColorArgs,
  Memory,
  UserProfile,
} from "@/lib/schema";
import type { CompanionPresence } from "@/lib/llm/prompts";
import {
  appendTurn,
  bumpMemoryAccess,
  captureMemory,
  getConversation,
  getCurrentRoomSlug,
  getHome,
  getMemories,
  getMemoryObjects,
  getRoom,
  getRooms,
  pickMemoryForProactiveRecall,
  resetHome,
  setCurrentRoom,
  setWallColor,
  subscribe,
  undoLast,
} from "@/lib/storage/local";
import { createBrowserSupabase } from "@/lib/db/supabase";

export function HomeExperience() {
  const [tick, setTick] = useState(0);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [justPlaced, setJustPlaced] = useState<string | null>(null);
  const [selectedMemoryId, setSelectedMemoryId] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [supabaseConfigured, setSupabaseConfigured] = useState(false);
  const [presence, setPresence] = useState<CompanionPresence | null>(null);
  const chatRef = useRef<ChatPanelHandle | null>(null);
  const supabase = useMemo(() => createBrowserSupabase(), []);

  // Subscribe to localStorage changes
  useEffect(() => subscribe(() => setTick((t) => t + 1)), []);

  // Listen for cloud state downloads (triggered by auth bootstrap)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.home) {
        import("@/lib/storage/local").then(({ replaceStateFromCloud }) => {
          replaceStateFromCloud({
            home: detail.home,
            rooms: detail.rooms ?? [],
            memories: detail.memories ?? [],
            objects: detail.objects ?? [],
          });
          setTick((t) => t + 1);
        });
      }
    };
    window.addEventListener("ourhome:cloud-state", handler);
    return () => window.removeEventListener("ourhome:cloud-state", handler);
  }, []);

  // Check Supabase auth state
  useEffect(() => {
    if (!supabase) {
      setSupabaseConfigured(false);
      return;
    }
    setSupabaseConfigured(true);

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email,
          name: session.user.user_metadata?.name ?? session.user.email,
          avatarUrl: session.user.user_metadata?.avatar_url,
          provider: session.user.app_metadata?.provider as "github" | "google" | "email" | undefined,
          createdAt: session.user.created_at,
          lastLogin: new Date().toISOString(),
        });
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email,
            name: session.user.user_metadata?.name ?? session.user.email,
            avatarUrl: session.user.user_metadata?.avatar_url,
            provider: session.user.app_metadata?.provider as "github" | "google" | "email" | undefined,
            createdAt: session.user.created_at,
            lastLogin: new Date().toISOString(),
          });

          // Auth bootstrap: sync localStorage → cloud on first login
          // or download cloud state for returning users
          try {
            const { userHasCloudHome, bootstrapNewHome, downloadCloudState } =
              await import("@/lib/auth/bootstrap");
            const { uploadState } = await import("@/lib/storage/sync");

            const hasCloudHome = await userHasCloudHome(session.user.id);
            const localHome = getHome();

            if (!hasCloudHome && localHome) {
              // First-time login: push localStorage to cloud
              const localRooms = getRooms();
              const localMemories = getMemories();
              const localObjects = getMemoryObjects();

              const result = await bootstrapNewHome(
                session.user.id,
                localHome,
                localRooms,
                localMemories,
                localObjects,
              );

              if (result.created) {
                console.log("[OurHome] Bootstrapped home to cloud:", result.homeId);
              } else if (result.error) {
                console.warn("[OurHome] Bootstrap error:", result.error);
              }
            } else if (hasCloudHome) {
              // Returning user: download cloud state
              const cloudState = await downloadCloudState(session.user.id);
              if (cloudState.home && !cloudState.error) {
                // Cloud wins — replace localStorage with cloud state
                // This ensures the user sees their cloud home on any device
                console.log("[OurHome] Downloaded cloud state for returning user");
                // The actual localStorage replacement happens via a custom event
                // that the storage module listens for
                window.dispatchEvent(new CustomEvent("ourhome:cloud-state", {
                  detail: cloudState,
                }));
              }
            }
          } catch (syncError) {
            // Auth sync failed — not fatal, user continues with localStorage
            console.warn("[OurHome] Auth sync failed:", syncError);
          }
        } else {
          setUser(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    document.body.classList.add("no-scroll");
    return () => document.body.classList.remove("no-scroll");
  }, []);

  // Proactive recall: companion brings up an old memory after idle period.
  // This is a LOCAL-ONLY message — it does NOT call the API.
  // It's the companion musing to themselves, not a conversation turn.
  useEffect(() => {
    const IDLE_MS = 30_000; // 30 seconds of inactivity
    let timer: ReturnType<typeof setTimeout> | null = null;

    const scheduleRecall = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const mem = pickMemoryForProactiveRecall();
        if (mem) {
          const label = mem.title ?? mem.body.slice(0, 40);
          const intros = [
            `I was just thinking about ${label}...`,
            `Do you remember ${label}? It came to mind just now.`,
            `That memory about ${label} — it still lingers here.`,
          ];
          const intro = intros[Math.floor(Math.random() * intros.length)];
          // Local-only: store as a silent companion turn.
          // Silent turns appear in the chat but are NEVER sent to the API.
          appendTurn("companion", intro, true);
          setTick((t) => t + 1);
        }
      }, IDLE_MS);
    };

    // Schedule initial recall timer
    scheduleRecall();

    // Reset timer on any user interaction
    const resetEvents = ["click", "keydown", "touchstart"];
    const resetHandler = () => scheduleRecall();
    resetEvents.forEach((evt) => window.addEventListener(evt, resetHandler));

    return () => {
      if (timer) clearTimeout(timer);
      resetEvents.forEach((evt) => window.removeEventListener(evt, resetHandler));
    };
  }, []);

  const home = getHome();
  const currentRoomSlug = getCurrentRoomSlug();
  const room = getRoom(currentRoomSlug);
  const rooms = getRooms();
  const memories = getMemories();
  const memoryObjects = getMemoryObjects();
  const conversation = getConversation();

  const selectedMemory = useMemo(() => {
    return selectedMemoryId ? memories.find((m) => m.id === selectedMemoryId) ?? null : null;
  }, [selectedMemoryId, memories]);

  const handleRoomChange = useCallback((slug: string) => {
    setCurrentRoom(slug);
    setTick((t) => t + 1);
  }, []);

  const memoriesById = useMemo(() => {
    const map: Record<string, Memory> = {};
    for (const m of memories) map[m.id] = m;
    return map;
  }, [memories]);

  const chatTurns: ChatTurn[] = useMemo(
    () =>
      conversation.map((t) => ({
        role: t.role,
        content: t.content,
        silent: t.silent,
      })),
    [conversation],
  );

  const handleTurn = useCallback((turn: ChatTurn) => {
    appendTurn(turn.role, turn.content, turn.silent);
  }, []);

  const handleCapture = useCallback((capture: CaptureMemoryArgs) => {
    const { memory } = captureMemory({
      type: capture.type,
      title: capture.title,
      body: capture.body,
      roomSlug: capture.roomSlug,
      emotionalValence: capture.emotionalValence,
      importance: capture.importance,
      tags: capture.tags,
    });
    setJustPlaced(memory.id);
    window.setTimeout(
      () => setJustPlaced((v) => (v === memory.id ? null : v)),
      1400,
    );
  }, []);

  const handleWallColor = useCallback((args: ChangeWallColorArgs) => {
    setWallColor(currentRoomSlug, args.wall, args.color, args.colorName);
  }, [currentRoomSlug]);

  const handleUndo = useCallback(() => {
    undoLast();
  }, []);

  const handlePresence = useCallback((p: CompanionPresence) => {
    setPresence(p);
  }, []);

  const handleFrameClick = useCallback((memoryId: string) => {
    setHighlighted(memoryId);
    window.setTimeout(
      () => setHighlighted((v) => (v === memoryId ? null : v)),
      3200,
    );
    const mem = bumpMemoryAccess(memoryId);
    if (mem) {
      setSelectedMemoryId(memoryId);
      // Local-only: mark frame-click as a silent turn.
      // Silent turns appear in the chat but are NEVER sent to the API.
      const label = mem.title ?? mem.body.slice(0, 40);
      appendTurn("user", `*(looks at the frame of "${label}")*`, true);
      setTick((t) => t + 1);
    }
  }, []);

  const handleExport = useCallback(async () => {
    if (!home) return;
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ home, memories }),
      });
      if (!res.ok) {
        alert(`Export failed: HTTP ${res.status}`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const today = new Date().toISOString().slice(0, 10);
      a.download = `ourhome-${home.companion.name.toLowerCase().replace(/\s+/g, "-")}-${today}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Export failed: ${err instanceof Error ? err.message : err}`);
    }
  }, [home, memories]);

  const handleLogout = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
  }, [supabase]);

  if (!home || !room) return null;

  return (
    <div className="fixed inset-0 flex">
      {/* Scene */}
      <div className="absolute inset-0">
        <SceneCanvas>
          {currentRoomSlug === "kitchen" ? (
            <Kitchen
              room={room}
              memoryObjects={memoryObjects}
              memoriesById={memoriesById}
              onFrameClick={handleFrameClick}
              highlightedMemoryId={highlighted}
              recentlyPlacedMemoryId={justPlaced}
              presence={presence}
              key={tick}
            />
          ) : (
            <LivingRoom
              room={room}
              memoryObjects={memoryObjects}
              memoriesById={memoriesById}
              onFrameClick={handleFrameClick}
              highlightedMemoryId={highlighted}
              recentlyPlacedMemoryId={justPlaced}
              presence={presence}
              key={tick}
            />
          )}
        </SceneCanvas>
      </div>

      {/* Room navigation — bottom center */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
        {rooms.map((r) => (
          <button
            key={r.slug}
            onClick={() => handleRoomChange(r.slug)}
            className={`px-3 py-1.5 rounded-md text-[10px] tracking-[0.15em] uppercase transition-colors border ${
              r.slug === currentRoomSlug
                ? "bg-amber-100/15 border-amber-100/30 text-amber-100/90"
                : "bg-black/40 border-amber-200/10 text-amber-100/40 hover:text-amber-100/70 hover:border-amber-200/20"
            }`}
            title={r.name}
          >
            {r.name}
          </button>
        ))}
      </div>

      {/* Top-left: home name + meta */}
      <div className="pointer-events-none absolute left-6 top-5 text-amber-100/60 text-xs tracking-[0.18em] uppercase">
        {home.name ?? "Home"} · {home.season} · {memories.length}{" "}
        {memories.length === 1 ? "memory" : "memories"}
      </div>

      {/* Top-right: menu */}
      <div className="absolute right-5 top-5 flex items-center gap-4">
        <Link
          href="/about"
          className="text-amber-100/30 hover:text-amber-100/70 text-[10px] tracking-[0.18em] uppercase"
        >
          about
        </Link>
        <button
          onClick={handleExport}
          disabled={memories.length === 0}
          className="text-amber-100/40 hover:text-amber-100/85 text-[10px] tracking-[0.18em] uppercase disabled:opacity-20"
          title="Download your home as a folder of markdown you can open in Obsidian"
        >
          export
        </button>
        <button
          onClick={() => {
            if (confirm("Start over? This erases your local home.")) {
              resetHome();
              window.location.reload();
            }
          }}
          className="text-amber-100/30 hover:text-amber-100/70 text-[10px] tracking-[0.18em] uppercase"
        >
          reset
        </button>
        {/* Auth: Login or User */}
        {supabaseConfigured ? (
          user ? (
            <div className="flex items-center gap-2">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name ?? "User"}
                  className="w-6 h-6 rounded-full border border-amber-200/20"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-amber-100/20 flex items-center justify-center text-[8px] text-amber-100/60">
                  {user.name?.[0]?.toUpperCase() ?? "?"}
                </div>
              )}
              <button
                onClick={handleLogout}
                className="text-amber-100/30 hover:text-amber-100/70 text-[10px] tracking-[0.18em] uppercase"
                title="Sign out"
              >
                logout
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="text-amber-100/50 hover:text-amber-100/85 text-[10px] tracking-[0.18em] uppercase"
            >
              login
            </Link>
          )
        ) : null}
      </div>

      {/* Chat — lower right, semi-translucent */}
      <div className="absolute bottom-6 right-6 w-[min(420px,calc(100vw-3rem))] h-[min(560px,calc(100vh-5rem))] rounded-lg border border-amber-200/10 bg-black/55 backdrop-blur-md shadow-2xl">
        <ChatPanel
          companion={home.companion}
          room={room}
          season={home.season}
          conversation={chatTurns}
          recentMemories={memories.slice(-8)}
          onCapture={handleCapture}
          onWallColor={handleWallColor}
          onUndo={handleUndo}
          onTurn={handleTurn}
          onPresence={handlePresence}
          handleRef={chatRef}
        />
      </div>

      {/* Memory detail overlay */}
      {selectedMemory && (
        <MemoryDetailPanel
          memory={selectedMemory}
          onClose={() => setSelectedMemoryId(null)}
        />
      )}
    </div>
  );
}