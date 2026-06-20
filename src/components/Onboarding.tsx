"use client";

/**
 * Onboarding — the naming moment.
 *
 * Per the product brief: naming the companion is part of the emotional
 * arc, not a settings form. Minimal chrome, breathable pacing.
 */

import { useEffect, useRef, useState } from "react";
import { createHome } from "@/lib/storage/local";
import { ITEM_CATALOG } from "@/lib/onboarding/unpack";
import { UnpackFlow } from "@/components/onboarding/UnpackFlow";

function StepWrapper({
  children,
  visible,
}: {
  children: React.ReactNode;
  visible: boolean;
}) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (visible) {
      const t = setTimeout(() => setShow(true), 20);
      return () => clearTimeout(t);
    }
    setShow(false);
  }, [visible]);
  if (!visible) return null;
  return (
    <div
      className={`transition-all duration-700 ease-out ${
        show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
    >
      {children}
    </div>
  );
}

export function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState<"welcome" | "name" | "pronouns" | "items" | "unpacking">("welcome");
  const [name, setName] = useState("");
  const [pronouns, setPronouns] = useState("they/them");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [unpackedItems, setUnpackedItems] = useState<string[]>([]);
  const [itemPlacements, setItemPlacements] = useState<Record<string, string>>({});
  const [currentItem, setCurrentItem] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.body.classList.add("no-scroll");
    return () => document.body.classList.remove("no-scroll");
  }, []);

  const handleName = () => {
    if (!name.trim()) return;
    setStep("pronouns");
  };

  const handleItems = () => {
    if (selectedItems.length === 0) return;
    setStep("unpacking");
  };

  const handleFinish = () => {
    createHome(name.trim(), pronouns);
    onComplete();
  };

  const toggleItem = (itemId: string) => {
    setSelectedItems((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  // Unpacking: show each item one at a time
  const remainingItems = selectedItems.filter((id) => !unpackedItems.includes(id));

  const handleItemPlaced = (itemId: string, _story: string, room: string) => {
    setUnpackedItems((prev) => [...prev, itemId]);
    setItemPlacements((prev) => ({ ...prev, [itemId]: room }));
    setCurrentItem(null);
  };

  // When all items unpacked, finish
  useEffect(() => {
    if (step === "unpacking" && selectedItems.length > 0 && unpackedItems.length === selectedItems.length) {
      // All items unpacked — create the home
      setTimeout(() => handleFinish(), 1500);
    }
  }, [step, selectedItems, unpackedItems]);

  useEffect(() => {
    if (step === "name" || step === "pronouns") {
      const t = setTimeout(() => inputRef.current?.focus(), 350);
      return () => clearTimeout(t);
    }
  }, [step]);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#1a0f0a] text-amber-50">
      <div className="w-full max-w-md px-8">
        <StepWrapper visible={step === "welcome"}>
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
        </StepWrapper>

        <StepWrapper visible={step === "name"}>
          <div className="space-y-8">
            <p className="text-amber-100/70 leading-relaxed">
              Before we begin — what should your companion be called?
            </p>
            <input
              ref={inputRef}
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
        </StepWrapper>

        <StepWrapper visible={step === "pronouns"}>
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
                onClick={() => setStep("items")}
                className="text-amber-200/80 hover:text-amber-100 text-xs uppercase tracking-[0.2em]"
              >
                what did you bring?
              </button>
            </div>
          </div>
        </StepWrapper>

        {/* Item selection */}
        <StepWrapper visible={step === "items"}>
          <div className="space-y-6">
            <p className="text-amber-100/70 leading-relaxed">
              You're moving in. What did you bring with you?
            </p>
            <p className="text-amber-100/40 text-xs italic">
              Choose at least one. These are the things that will hold your first memories.
            </p>
            <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto">
              {ITEM_CATALOG.map((item) => (
                <button
                  key={item.id}
                  onClick={() => toggleItem(item.id)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-left transition-all ${
                    selectedItems.includes(item.id)
                      ? "border-amber-200/60 bg-amber-200/5 text-amber-100"
                      : "border-amber-200/10 text-amber-100/50 hover:border-amber-200/30 hover:text-amber-100/80"
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span className="text-sm">{item.name}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setStep("pronouns")}
                className="text-amber-200/40 hover:text-amber-200/80 text-xs uppercase tracking-[0.2em]"
              >
                back
              </button>
              <button
                onClick={handleItems}
                disabled={selectedItems.length === 0}
                className="text-amber-200/80 hover:text-amber-100 text-xs uppercase tracking-[0.2em] disabled:opacity-30"
              >
                unpack ({selectedItems.length})
              </button>
            </div>
          </div>
        </StepWrapper>

        {/* Unpacking — one item at a time */}
        <StepWrapper visible={step === "unpacking"}>
          <div className="space-y-6">
            {unpackedItems.length === selectedItems.length ? (
              <div className="text-center space-y-6">
                <div className="text-2xl font-serif text-amber-100/80">
                  The boxes are empty.
                </div>
                <p className="text-amber-100/50 leading-relaxed">
                  {name} looks around the room. The boxes are gone, the things are placed.
                  This is home now.
                </p>
                <div className="text-amber-100/30 text-sm italic">opening the door...</div>
              </div>
            ) : currentItem ? (
              <UnpackFlow
                item={ITEM_CATALOG.find((i) => i.id === currentItem)!}
                companionName={name}
                state={{
                  stage: "unpacking",
                  companionName: name,
                  companionPronouns: pronouns,
                  companionTraits: [],
                  selectedItems,
                  unpackedItems,
                  itemPlacements,
                }}
                onMemoryCaptured={handleItemPlaced}
                onCancel={() => {
                  // Skip item — mark as unpacked without memory
                  setUnpackedItems((prev) => [...prev, currentItem]);
                  setCurrentItem(null);
                }}
              />
            ) : remainingItems.length > 0 ? (
              <div className="text-center space-y-6">
                <p className="text-amber-100/50 text-sm">
                  {unpackedItems.length} of {selectedItems.length} unpacked
                </p>
                <button
                  onClick={() => setCurrentItem(remainingItems[0])}
                  className="text-amber-200/80 hover:text-amber-100 text-sm uppercase tracking-[0.2em] border-b border-amber-200/20 hover:border-amber-100/60 pb-1 transition-colors"
                >
                  pull something out
                </button>
                {unpackedItems.map((id) => {
                  const item = ITEM_CATALOG.find((i) => i.id === id);
                  return (
                    <div key={id} className="text-amber-100/30 text-xs">
                      {item?.icon} {item?.name} → {itemPlacements[id]?.replace(/_/g, " ")}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </StepWrapper>
      </div>
    </div>
  );
}
