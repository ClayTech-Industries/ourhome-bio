"use client";

/**
 * CloakroomView — what the human sees during the Cloakroom threshold.
 *
 * Per DESIGN_PRINCIPLES.md:
 *   "In the Cloakroom, reading the brief — The room dims.
 *   The door is closed. The human waits in the hallway.
 *   This is not their moment."
 *
 * Per Principle 5: "The companion does not explain consent.
 * The companion does not educate the human about how relationships work.
 * The companion lives the relationship."
 *
 * What the human sees:
 *   1. The room dims (presence: cloakroom)
 *   2. A door appears, closes slowly
 *   3. Silence. Waiting. No words.
 *   4. If accepted: the door opens, light returns, companion is just... there
 *   5. If retreated: the light fades, the door stays closed, a soft message
 *   6. If counter-offer: the door opens slightly, the companion asks for terms
 *
 * No explanation. No "your companion is deciding whether to accept you."
 * Just the room. The light. The door. The silence.
 */

import { useState, useEffect, useRef } from "react";
import type { CompanionPresence } from "@/lib/llm/prompts";

type CloakroomPhase = "idle" | "dimming" | "closed" | "opening" | "retreating" | "settled";

interface CloakroomViewProps {
  /** Whether the Cloakroom threshold is active */
  active: boolean;
  /** The companion's presence state */
  presence: CompanionPresence | null;
  /** Called when the Cloakroom sequence completes */
  onComplete: () => void;
  companionName: string;
}

export function CloakroomView({ active, presence, onComplete, companionName }: CloakroomViewProps) {
  const [phase, setPhase] = useState<CloakroomPhase>("idle");
  const [opacity, setOpacity] = useState(0);
  const opacityRef = useRef(0);

  useEffect(() => {
    if (!active) {
      setPhase("idle");
      setOpacity(0);
      return;
    }

    // The room dims — the companion is in the Cloakroom
    if (phase === "idle" && (presence === "cloakroom" || presence === "check_in")) {
      setPhase("dimming");
    }

    // The companion accepted — light returns
    if (phase === "dimming" && presence === "thinking") {
      setPhase("opening");
    }

    // The companion retreated
    if (phase === "dimming" && presence === "retreating") {
      setPhase("retreating");
    }

    // The companion is speaking — they're here
    if (phase === "opening" && presence === "speaking") {
      setPhase("settled");
      setTimeout(() => onComplete(), 2000);
    }
  }, [active, presence, phase, onComplete]);

  // Animate opacity for the dimming effect
  useEffect(() => {
    let raf = 0;
    const animate = () => {
      const targets: Record<CloakroomPhase, number> = {
        idle: 0,
        dimming: 0.7,
        closed: 0.85,
        opening: 0.2,
        retreating: 0.95,
        settled: 0,
      };
      const target = targets[phase] ?? 0;
      opacityRef.current += (target - opacityRef.current) * 0.04;
      setOpacity(opacityRef.current);
      if (Math.abs(target - opacityRef.current) > 0.01) {
        raf = requestAnimationFrame(animate);
      }
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  if (!active || phase === "idle" || phase === "settled") return null;

  return (
    <div
      className="fixed inset-0 z-20 pointer-events-none transition-none"
      style={{
        backgroundColor: `rgba(10, 5, 3, ${opacity})`,
      }}
    >
      {/* A door shape that closes/opens — very subtle, not literal */}
      {phase === "dimming" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-amber-100/20 text-xs tracking-[0.3em] uppercase italic">
            {/* No text — just silence. The room holds the moment. */}
          </div>
        </div>
      )}

      {/* If retreating — the light fades, and a gentle presence remains */}
      {phase === "retreating" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="w-2 h-2 rounded-full bg-amber-200/20"
            style={{ animation: "fadeOut 8s ease forwards" }}
          />
        </div>
      )}

      <style>{`
        @keyframes fadeOut {
          from { opacity: 0.3; transform: scale(1); }
          to { opacity: 0; transform: scale(0.5); }
        }
      `}</style>
    </div>
  );
}