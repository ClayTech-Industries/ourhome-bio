"use client";

import type { Memory } from "@/lib/schema";

interface Props {
  memory: Memory;
  onClose: () => void;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function MemoryDetailPanel({ memory, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-[min(520px,calc(100vw-2rem))] max-h-[80vh] overflow-y-auto rounded-xl border border-amber-200/15 bg-[#1c1917] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-amber-100/30 hover:text-amber-100/80 text-xs tracking-widest uppercase"
        >
          close
        </button>

        {/* Header */}
        <div className="mb-4">
          <div className="text-[10px] tracking-[0.2em] uppercase text-amber-100/40 mb-1">
            {memory.type.replace("_", " ")}
          </div>
          <h2 className="text-lg font-light text-amber-50/90 leading-snug pr-12">
            {memory.title ?? "Untitled memory"}
          </h2>
        </div>

        {/* Body */}
        <p className="text-sm text-amber-100/70 leading-relaxed whitespace-pre-wrap mb-6">
          {memory.body}
        </p>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-3 text-[10px] tracking-wider text-amber-100/30 mb-4">
          <span>{timeAgo(memory.createdAt)}</span>
          <span>·</span>
          <span>accessed {memory.accessCount} time{memory.accessCount === 1 ? "" : "s"}</span>
          <span>·</span>
          <span>importance {Math.round((memory.importance ?? 0.5) * 100)}%</span>
          <span>·</span>
          <span>patina {Math.round((memory.patina ?? 0) * 100)}%</span>
        </div>

        {/* Tags */}
        {memory.tags && memory.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {memory.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded-full border border-amber-200/10 text-[10px] text-amber-100/40 tracking-wide"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Emotional valence */}
        <div className="mt-5 pt-4 border-t border-amber-200/10">
          <div className="flex items-center justify-between">
            <span className="text-[10px] tracking-wider text-amber-100/30 uppercase">emotional valence</span>
            <div className="flex items-center gap-2">
              <div className="w-24 h-1 rounded-full bg-amber-100/10 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.abs((memory.emotionalValence ?? 0)) * 100}%`,
                    backgroundColor: (memory.emotionalValence ?? 0) >= 0 ? "#86efac" : "#fca5a5",
                    marginLeft: (memory.emotionalValence ?? 0) < 0 ? "auto" : "0",
                    marginRight: (memory.emotionalValence ?? 0) >= 0 ? "auto" : "0",
                  }}
                />
              </div>
              <span className="text-[10px] text-amber-100/40 w-8 text-right">
                {memory.emotionalValence?.toFixed(1) ?? "0.0"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
