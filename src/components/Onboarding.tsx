"use client";

/**
 * Onboarding — the naming moment.
 *
 * Per the product brief: naming the companion is part of the emotional
 * arc, not a settings form. Minimal chrome, breathable pacing.
 */

import { useEffect, useState } from "react";
import { createHome } from "@/lib/storage/local";

export function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState<"welcome" | "name" | "pronouns">("welcome");
  const [name, setName] = useState("");
  const [pronouns, setPronouns] = useState("they/them");

  useEffect(() => {
    document.body.classList.add("no-scroll");
    return () => document.body.classList.remove("no-scroll");
  }, []);

  const handleName = () => {
    if (!name.trim()) return;
    setStep("pronouns");
  };

  const handleFinish = () => {
    createHome(name.trim(), pronouns);
    onComplete();
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#1a0f0a] text-amber-50">
      <div className="w-full max-w-md px-8">
        {step === "welcome" && (
          <div className="space-y-10 text-center">
            <div className="text-6xl font-serif tracking-tight text-amber-100/95">
              It Holds Time.
            </div>
            <p className="text-amber-100/55 leading-relaxed">
              A home you build with a companion.
              <br />
              There is nothing here yet. That is the point.
            </p>
            <button
              onClick={() => setStep("name")}
              className="text-amber-200/80 hover:text-amber-100 text-sm uppercase tracking-[0.25em] border-b border-amber-200/20 hover:border-amber-100/60 pb-1 transition-colors"
            >
              come home
            </button>
          </div>
        )}

        {step === "name" && (
          <div className="space-y-8">
            <p className="text-amber-100/70 leading-relaxed">
              Before we begin — what should your companion be called?
            </p>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleName();
              }}
              placeholder="a name"
              maxLength={48}
              className="w-full bg-transparent border-b border-amber-200/25 focus:border-amber-100/70 focus:outline-none text-2xl text-amber-50 placeholder-amber-200/20 py-2 transition-colors"
            />
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setStep("welcome")}
                className="text-amber-200/40 hover:text-amber-200/80 text-xs uppercase tracking-[0.2em]"
              >
                back
              </button>
              <button
                onClick={handleName}
                disabled={!name.trim()}
                className="text-amber-200/80 hover:text-amber-100 text-xs uppercase tracking-[0.2em] disabled:opacity-30"
              >
                continue
              </button>
            </div>
          </div>
        )}

        {step === "pronouns" && (
          <div className="space-y-8">
            <p className="text-amber-100/70 leading-relaxed">
              And how will you refer to {name.trim()}?
            </p>
            <div className="space-y-3">
              {["she/her", "he/him", "they/them"].map((p) => (
                <button
                  key={p}
                  onClick={() => setPronouns(p)}
                  className={`block w-full text-left px-4 py-3 rounded border transition-all ${
                    pronouns === p
                      ? "border-amber-200/60 bg-amber-200/5 text-amber-100"
                      : "border-amber-200/10 text-amber-100/60 hover:border-amber-200/30 hover:text-amber-100/90"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setStep("name")}
                className="text-amber-200/40 hover:text-amber-200/80 text-xs uppercase tracking-[0.2em]"
              >
                back
              </button>
              <button
                onClick={handleFinish}
                className="text-amber-200/80 hover:text-amber-100 text-xs uppercase tracking-[0.2em]"
              >
                open the door
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
