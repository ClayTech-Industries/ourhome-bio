/**
 * Onboarding Unpacking System
 *
 * The first-run experience: instead of a form, new occupants unpack
 * moving boxes in the Living Room. Each item pulled from a box becomes
 * a lived memory.
 *
 * Flow:
 *   1. New occupant arrives — brief questionnaire (name, companion name, pronouns)
 *   2. "Which items did you bring?" — select from item catalog
 *   3. Those items appear packed in moving boxes in the Living Room
 *   4. Human pulls an item out → tells the story → companion captures memory
 *   5. They choose which room the item goes to → item appears in that room
 *   6. The companion now "inherently remembers" that item
 *
 * The system prompt isn't text — it's a collection of lived memories
 * attached to items. The companion learns who they are through unpacking.
 */

import type { RoomType } from "@/lib/schema";

// -----------------------------------------------------------------
// Item Catalog — what occupants can bring to their new home
// -----------------------------------------------------------------

export interface OnboardingItem {
  id: string;
  name: string;
  description: string;
  /** 3D shape hint for rendering */
  shape: "teacup" | "frame" | "book" | "blanket" | "instrument" | "tool" | "plant" | "vessel" | "token" | "letter";
  /** Default room suggestion (user can override) */
  defaultRoom: RoomType;
  /** Whether this item can hold a memory */
  canHoldMemory: boolean;
  /** Icon for the selection UI */
  icon: string;
}

export const ITEM_CATALOG: OnboardingItem[] = [
  {
    id: "teacup",
    name: "Teacup",
    description: "A cup that held morning conversations, quiet afternoons, shared warmth.",
    shape: "vessel",
    defaultRoom: "kitchen",
    canHoldMemory: true,
    icon: "☕",
  },
  {
    id: "photo_frame",
    name: "Photo Frame",
    description: "A frame waiting for the first memory to fill it.",
    shape: "frame",
    defaultRoom: "living_room",
    canHoldMemory: true,
    icon: "🖼️",
  },
  {
    id: "book",
    name: "A Book",
    description: "A book that meant something. Dog-eared, underlined, returned to often.",
    shape: "book",
    defaultRoom: "study",
    canHoldMemory: true,
    icon: "📚",
  },
  {
    id: "blanket",
    name: "Blanket",
    description: "Something soft. The weight of comfort, the smell of home.",
    shape: "blanket",
    defaultRoom: "bedroom",
    canHoldMemory: true,
    icon: "🧶",
  },
  {
    id: "instrument",
    name: "An Instrument",
    description: "Something that makes sound — a guitar, a kalimba, a small drum.",
    shape: "instrument",
    defaultRoom: "living_room",
    canHoldMemory: true,
    icon: "🎵",
  },
  {
    id: "tool",
    name: "A Tool",
    description: "Something practical. A thing used to make other things.",
    shape: "tool",
    defaultRoom: "kitchen",
    canHoldMemory: true,
    icon: "🔧",
  },
  {
    id: "plant",
    name: "A Plant",
    description: "Something alive that needs care. Growth that you tend to together.",
    shape: "plant",
    defaultRoom: "garden",
    canHoldMemory: true,
    icon: "🌱",
  },
  {
    id: "vessel",
    name: "A Vessel",
    description: "A bowl, a jar, a cup — something that holds. What will you fill it with?",
    shape: "vessel",
    defaultRoom: "kitchen",
    canHoldMemory: true,
    icon: "🏺",
  },
  {
    id: "token",
    name: "A Token",
    description: "A small object that means something. A stone, a coin, a button.",
    shape: "token",
    defaultRoom: "living_room",
    canHoldMemory: true,
    icon: "🔮",
  },
  {
    id: "letter",
    name: "A Letter",
    description: "Words someone wrote to you. Or words you wrote to yourself.",
    shape: "letter",
    defaultRoom: "study",
    canHoldMemory: true,
    icon: "✉️",
  },
];

// -----------------------------------------------------------------
// Onboarding flow types
// -----------------------------------------------------------------

export type OnboardingStage =
  | "welcome"        // "Welcome to your new home"
  | "companion"      // Name the companion, choose pronouns
  | "items"          // "What did you bring?" — select items
  | "unpacking"      // Pull items from boxes, tell stories, place in rooms
  | "settled";       // Unpacking complete — the home is ready

export interface OnboardingState {
  stage: OnboardingStage;
  companionName: string;
  companionPronouns: string;
  companionTraits: string[];
  /** Items the occupant chose to bring */
  selectedItems: string[];
  /** Items that have been unpacked (item id → memory placed) */
  unpackedItems: string[];
  /** Item id → room placement */
  itemPlacements: Record<string, RoomType>;
}

export const INITIAL_ONBOARDING: OnboardingState = {
  stage: "welcome",
  companionName: "",
  companionPronouns: "they/them",
  companionTraits: [],
  selectedItems: [],
  unpackedItems: [],
  itemPlacements: {},
};

// -----------------------------------------------------------------
// Moving box — what a box looks like in the Living Room
// -----------------------------------------------------------------

export interface MovingBox {
  id: string;
  /** Items packed in this box (not yet unpacked) */
  items: string[];
  /** Whether this box has been opened */
  opened: boolean;
  /** Position in the room */
  position: { x: number; y: number; z: number };
  /** Label on the box */
  label: string;
}

/**
 * Create moving boxes from selected items.
 * Distribute items across 2-4 boxes.
 */
export function createMovingBoxes(selectedItems: string[]): MovingBox[] {
  const boxes: MovingBox[] = [];
  const itemsPerBox = 3;
  const boxCount = Math.ceil(selectedItems.length / itemsPerBox);

  // Box positions in the living room — scattered on the floor
  const positions = [
    { x: -2.2, y: 0.2, z: -1.5 },
    { x: 2.0, y: 0.2, z: -1.8 },
    { x: -1.5, y: 0.2, z: 1.8 },
    { x: 1.8, y: 0.2, z: 1.5 },
  ];

  const labels = ["Fragile", "Living Room", "Memories", "Kitchen"];

  for (let i = 0; i < boxCount; i++) {
    const start = i * itemsPerBox;
    const end = Math.min(start + itemsPerBox, selectedItems.length);
    boxes.push({
      id: `box_${i}`,
      items: selectedItems.slice(start, end),
      opened: false,
      position: positions[i] ?? positions[0],
      label: labels[i] ?? "Box",
    });
  }

  return boxes;
}

// -----------------------------------------------------------------
// Item rendering hints — how to render each item shape in 3D
// -----------------------------------------------------------------

export function getItemGeometry(shape: OnboardingItem["shape"]): {
  geometry: string;
  args: number[];
  color: string;
} {
  const shapes: Record<string, { geometry: string; args: number[]; color: string }> = {
    vessel: { geometry: "cylinder", args: [0.08, 0.06, 0.12, 12], color: "#D4A882" },
    frame: { geometry: "box", args: [0.15, 0.2, 0.02], color: "#3a2818" },
    book: { geometry: "box", args: [0.12, 0.18, 0.04], color: "#4a3525" },
    blanket: { geometry: "box", args: [0.3, 0.05, 0.2], color: "#8a6a55" },
    instrument: { geometry: "box", args: [0.15, 0.35, 0.08], color: "#6b4f3a" },
    tool: { geometry: "box", args: [0.05, 0.2, 0.05], color: "#5a5040" },
    plant: { geometry: "cylinder", args: [0.06, 0.05, 0.15, 8], color: "#4a7a3a" },
    token: { geometry: "sphere", args: [0.04, 8, 8], color: "#8a7a60" },
    letter: { geometry: "box", args: [0.1, 0.02, 0.14], color: "#E8D5B7" },
  };

  return shapes[shape] ?? shapes.token;
}