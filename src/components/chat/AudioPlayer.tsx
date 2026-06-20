"use client";

/**
 * AudioPlayer — plays TTS audio for companion responses.
 *
 * When enabled, companion text is sent to /api/tts and the
 * resulting audio plays automatically. No visible UI controls —
 * the voice IS the interface (Principle 3).
 *
 * The user can toggle voice on/off via a small speaker icon.
 */

import { useState, useRef, useCallback } from "react";

interface AudioPlayerProps {
  enabled: boolean;
  voiceId?: string;
}

export function AudioPlayer({ enabled, voiceId }: AudioPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const speak = useCallback(async (text: string) => {
    if (!enabled || !text.trim()) return;

    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voiceId }),
      });

      if (!response.ok) return;

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      // Stop any current playback
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }

      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onplay = () => setPlaying(true);
      audio.onended = () => {
        setPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };
      audio.onerror = () => {
        setPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };

      await audio.play();
    } catch (error) {
      console.error("TTS playback failed:", error);
      setPlaying(false);
    }
  }, [enabled, voiceId]);

  // Expose speak function via ref for parent to call
  // Using a custom event so ChatPanel can trigger it
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("ourhome:tts-ready", { detail: { speak } }));
  }

  return null; // No visible UI — voice is the interface
}

/**
 * Speak text via TTS. Called from ChatPanel when companion text arrives.
 */
export async function speakText(text: string, voiceId?: string): Promise<void> {
  try {
    const response = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voiceId }),
    });

    if (!response.ok) return;

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    audio.onended = () => URL.revokeObjectURL(audioUrl);
    await audio.play();
  } catch (error) {
    console.error("TTS failed:", error);
  }
}