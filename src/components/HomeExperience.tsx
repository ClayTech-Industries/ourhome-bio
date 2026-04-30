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
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SceneCanvas } from "@/components/scene/SceneCanvas";
import { LivingRoom } from "@/components/scene/LivingRoom";
import { Kitchen } from "@/components/scene/Kitchen";
import {
  ChatPanel,
  type ChatPanelHandle,
  type ChatTurn,
} from "@/components/chat/ChatPanel";
import type {
  CaptureMemoryArgs,
  ChangeWallColorArgs,
  Memory,
  UserProfile,
} from "@/lib/schema";
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
  const [user, setUser] = useState<UserProfile | null>(null);
  const [supabaseConfigured, setSupabaseConfigured] = useState(false);
  const chatRef = useRef<ChatPanelHandle | null>(null);
  const supabase = useMemo(() => createBrowserSupabase(), []);

  // Subscribe to localStorage changes
  useEffect(() => subscribe(() => setTick((t) => t + 1)), []);

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
      (_event, session) => {
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

  const home = getHome();
  const currentRoomSlug = getCurrentRoomSlug();
  const room = getRoom(currentRoomSlug);
  const rooms = getRooms();
  const memories = getMemories();
  const memoryObjects = getMemoryObjects();
  const conversation = getConversation();

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
      })),
    [conversation],
  );

  const handleTurn = useCallback((turn: ChatTurn) => {
    appendTurn(turn.role, turn.content);
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

  const handleFrameClick = useCallback((memoryId: string) => {
    setHighlighted(memoryId);
    window.setTimeout(
      () => setHighlighted((v) => (v === memoryId ? null : v)),
      3200,
    );
    const mem = bumpMemoryAccess(memoryId);
    if (mem && chatRef.current) {
      const label = mem.title ?? mem.body.slice(0, 40);
      void chatRef.current.dispatch(`*(looks at the frame of "${label}")*`);
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
          handleRef={chatRef}
        />
      </div>
    </div>
  );
}
