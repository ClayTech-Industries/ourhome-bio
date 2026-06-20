"use client";

/**
 * VoiceInput — microphone button for speech-to-text.
 *
 * Records audio from the browser, sends to /api/stt,
 * and returns the transcribed text to the parent.
 *
 * No spinners, no loading UI (Principle 3: the room IS the interface).
 * The mic button gently pulses while recording — that's the only indicator.
 */

import { useRef, useState, useCallback } from "react";

interface VoiceInputProps {
  onTranscription: (text: string) => void;
  disabled?: boolean;
}

export function VoiceInput({ onTranscription, disabled }: VoiceInputProps) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());

        setTranscribing(true);
        try {
          const formData = new FormData();
          formData.append("audio", audioBlob, "audio.webm");

          const response = await fetch("/api/stt", {
            method: "POST",
            body: formData,
          });

          if (response.ok) {
            const data = await response.json();
            if (data.text) {
              onTranscription(data.text);
            }
          }
        } catch (error) {
          console.error("STT request failed:", error);
        } finally {
          setTranscribing(false);
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch (error) {
      console.error("Microphone access failed:", error);
    }
  }, [onTranscription]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  }, [recording]);

  const handleClick = () => {
    if (recording) {
      stopRecording();
    } else if (!transcribing) {
      startRecording();
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled || transcribing}
      className={`text-xs uppercase tracking-[0.15em] px-2 py-1 transition-colors disabled:opacity-30 ${
        recording
          ? "text-rose-300/80"
          : transcribing
            ? "text-amber-200/40"
            : "text-amber-200/40 hover:text-amber-100/70"
      }`}
      title={recording ? "Stop recording" : transcribing ? "Transcribing..." : "Speak"}
    >
      {transcribing ? "..." : recording ? "■" : "🎙"}
    </button>
  );
}