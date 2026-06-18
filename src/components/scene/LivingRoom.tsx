"use client";

/**
 * LivingRoom — the first room.
 *
 * A simple stylized interior: four walls, a floor, soft warm light,
 * and a Memory Wall on the east side where frames accumulate.
 *
 * Companion presence states are rendered as environmental changes:
 *   - thinking: light dims slightly, room settles — the house breathes
 *   - recalling: a Memory Frame glows — the companion is looking at it
 *   - considering_capture: warmth spreads on the Memory Wall
 *   - speaking: light returns to normal
 *
 * Per Principle 3: "No loading spinners. No 'typing...' indicators.
 * The room IS the interface."
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Room, MemoryObject, Memory, WallKey } from "@/lib/schema";
import type { CompanionPresence } from "@/lib/llm/prompts";
import { MemoryFrame } from "./MemoryFrame";
import { presenceToEnvironment } from "./presence-utils";
import { WallShader } from "./WallShader";
import { computeWallPatina, getGhostLayers, computeMemoryGlowCenter } from "@/lib/patina/wall-patina";
import { getRoomLighting } from "@/lib/scene/lighting";

interface LivingRoomProps {
  room: Room;
  memoryObjects: MemoryObject[];
  memoriesById: Record<string, Memory>;
  onFrameClick?: (memoryId: string) => void;
  highlightedMemoryId?: string | null;
  recentlyPlacedMemoryId?: string | null;
  presence?: CompanionPresence | null;
}

const ROOM_W = 6; // east-west
const ROOM_D = 6; // north-south
const ROOM_H = 3.2;

export function LivingRoom({
  room,
  memoryObjects,
  memoriesById,
  onFrameClick,
  highlightedMemoryId,
  recentlyPlacedMemoryId,
  presence,
}: LivingRoomProps) {
  const wallColors = room.wallColors ?? {};
  const north = wallColors.north ?? "#E8D5B7";
  const south = wallColors.south ?? "#E8D5B7";
  const east = wallColors.east ?? "#C4A882"; // Memory Wall — warmer
  const west = wallColors.west ?? "#E8D5B7";
  const floorColor = "#6b4f3a";

  const env = presenceToEnvironment(presence);
  const baseIntensity = room.lighting?.intensity ?? 1;
  const presetName = room.lighting?.preset ?? "afternoon";
  const lighting = getRoomLighting(presetName);

  // Compute patina and ghost layers for each wall (Sprint 2)
  const memoriesInRoom = memoryObjects
    .map((o) => memoriesById[o.memoryId])
    .filter((m): m is Memory => Boolean(m));

  const wallPatina = (wall: WallKey) => computeWallPatina(wall, room, room.wallHistory?.[wall], memoriesInRoom);
  const ghostFor = (wall: WallKey) => getGhostLayers(wall, room.wallHistory?.[wall]);

  // Memory glow center for east wall
  const glowCenter = computeMemoryGlowCenter(memoryObjects);

  // Refs for lerp-able values
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const dirRef = useRef<THREE.DirectionalLight>(null);
  const pointRef = useRef<THREE.PointLight>(null);

  useFrame(() => {
    // Smoothly lerp lighting toward the presence-driven target
    if (ambientRef.current) {
      const target = env.ambientIntensity * baseIntensity;
      ambientRef.current.intensity += (target - ambientRef.current.intensity) * 0.04;
    }
    if (dirRef.current) {
      const target = env.directionalIntensity * baseIntensity;
      dirRef.current.intensity += (target - dirRef.current.intensity) * 0.04;
    }
    if (pointRef.current) {
      const target = env.pointLightIntensity * baseIntensity;
      pointRef.current.intensity += (target - pointRef.current.intensity) * 0.04;
    }
  });

  return (
    <group>
      {/* Lighting — responsive to companion presence */}
      <ambientLight ref={ambientRef} intensity={env.ambientIntensity * baseIntensity} color="#FFF2DC" />
      <directionalLight
        ref={dirRef}
        position={[4, 6, 3]}
        intensity={env.directionalIntensity * baseIntensity}
        color="#FFD9A8"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      {/* Warm fill from window side (south) */}
      <pointLight
        ref={pointRef}
        position={[0, 2, -2]}
        intensity={env.pointLightIntensity * baseIntensity}
        color="#FFC58A"
        distance={10}
      />

      {/* Floor */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[ROOM_W, ROOM_D]} />
        <meshStandardMaterial color={floorColor} roughness={0.85} />
      </mesh>

      {/* Ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, ROOM_H, 0]}>
        <planeGeometry args={[ROOM_W, ROOM_D]} />
        <meshStandardMaterial color="#F4E9D8" roughness={1} />
      </mesh>

      {/* North wall (back) — with patina and ghost layers */}
      <WallShader
        position={[0, ROOM_H / 2, -ROOM_D / 2]}
        width={ROOM_W}
        height={ROOM_H}
        color={north}
        patina={wallPatina("north")}
        ghostColor1={ghostFor("north").ghost1 ?? north}
        ghostColor2={ghostFor("north").ghost2 ?? north}
        ghostOpacity={ghostFor("north").opacity}
        lightIntensity={lighting.wallIntensity}
        lightTint={lighting.wallTint}
      />
      {/* South wall (front, behind camera) */}
      <WallShader
        position={[0, ROOM_H / 2, ROOM_D / 2]}
        rotationY={Math.PI}
        width={ROOM_W}
        height={ROOM_H}
        color={south}
        patina={wallPatina("south")}
        ghostColor1={ghostFor("south").ghost1 ?? south}
        ghostColor2={ghostFor("south").ghost2 ?? south}
        ghostOpacity={ghostFor("south").opacity}
        lightIntensity={lighting.wallIntensity}
        lightTint={lighting.wallTint}
      />
      {/* West wall (left) */}
      <WallShader
        position={[-ROOM_W / 2, ROOM_H / 2, 0]}
        rotationY={Math.PI / 2}
        width={ROOM_D}
        height={ROOM_H}
        color={west}
        patina={wallPatina("west")}
        ghostColor1={ghostFor("west").ghost1 ?? west}
        ghostColor2={ghostFor("west").ghost2 ?? west}
        ghostOpacity={ghostFor("west").opacity}
        lightIntensity={lighting.wallIntensity}
        lightTint={lighting.wallTint}
      />
      {/* East wall (right) — the Memory Wall with warmth and glow */}
      <WallShader
        position={[ROOM_W / 2, ROOM_H / 2, 0]}
        rotationY={-Math.PI / 2}
        width={ROOM_D}
        height={ROOM_H}
        color={east}
        patina={wallPatina("east")}
        memoryWarmth={env.memoryWallWarmth}
        memoryGlowPos={glowCenter.pos}
        memoryGlowRadius={glowCenter.radius}
        ghostColor1={ghostFor("east").ghost1 ?? east}
        ghostColor2={ghostFor("east").ghost2 ?? east}
        ghostOpacity={ghostFor("east").opacity}
        lightIntensity={lighting.wallIntensity}
        lightTint={lighting.wallTint}
        isMemoryWall
      />

      {/* A simple suggestion of a couch — geometric, no clutter */}
      <Couch position={[-1.6, 0, 0]} />

      {/* Memory frames on the east wall */}
      {memoryObjects.map((obj) => {
        const memory = memoriesById[obj.memoryId];
        if (!memory) return null;
        // If companion is recalling, highlight the most recent frame
        const isRecalling = presence === "recalling" && obj === memoryObjects[memoryObjects.length - 1];
        return (
          <MemoryFrame
            key={obj.id}
            object={obj}
            memory={memory}
            highlighted={highlightedMemoryId === memory.id || isRecalling}
            justPlaced={recentlyPlacedMemoryId === memory.id}
            onClick={() => onFrameClick?.(memory.id)}
          />
        );
      })}
    </group>
  );
}

function Wall({
  position,
  rotationY = 0,
  width,
  height,
  color,
}: {
  position: [number, number, number];
  rotationY?: number;
  width: number;
  height: number;
  color: string;
}) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const targetColor = useRef(new THREE.Color(color));
  // Update target when prop changes
  targetColor.current.set(color);

  useFrame(() => {
    if (!matRef.current) return;
    matRef.current.color.lerp(targetColor.current, 0.06);
  });

  return (
    <mesh position={position} rotation={[0, rotationY, 0]} receiveShadow>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial ref={matRef} color={color} roughness={0.95} />
    </mesh>
  );
}

/**
 * MemoryWallMesh — the east wall with warmth response.
 * When the companion is considering capturing a memory,
 * this wall breathes warmer.
 */
function MemoryWallMesh({
  position,
  rotationY = 0,
  width,
  height,
  color,
  warmth,
}: {
  position: [number, number, number];
  rotationY?: number;
  width: number;
  height: number;
  color: string;
  warmth: number;
}) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const baseColor = useRef(new THREE.Color(color));
  const warmColor = useRef(new THREE.Color("#D4A06A")); // warm amber
  const targetColor = useRef(new THREE.Color(color));

  useFrame(() => {
    if (!matRef.current) return;
    // Blend toward warm when companion is considering capture
    if (warmth > 0) {
      targetColor.current.copy(baseColor.current).lerp(warmColor.current, warmth * 0.3);
    } else {
      targetColor.current.copy(baseColor.current);
    }
    matRef.current.color.lerp(targetColor.current, 0.04);
  });

  return (
    <mesh position={position} rotation={[0, rotationY, 0]} receiveShadow>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial ref={matRef} color={color} roughness={0.92} />
    </mesh>
  );
}

function Couch({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* base */}
      <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.4, 0.7, 1.0]} />
        <meshStandardMaterial color="#8a6a55" roughness={0.9} />
      </mesh>
      {/* back */}
      <mesh position={[0, 0.95, -0.4]} castShadow>
        <boxGeometry args={[2.4, 0.9, 0.25]} />
        <meshStandardMaterial color="#7a5c49" roughness={0.9} />
      </mesh>
      {/* cushion highlights */}
      <mesh position={[-0.6, 0.72, 0.05]}>
        <boxGeometry args={[1.0, 0.18, 0.85]} />
        <meshStandardMaterial color="#a0806b" roughness={0.85} />
      </mesh>
      <mesh position={[0.6, 0.72, 0.05]}>
        <boxGeometry args={[1.0, 0.18, 0.85]} />
        <meshStandardMaterial color="#a0806b" roughness={0.85} />
      </mesh>
    </group>
  );
}