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

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Room, MemoryObject, Memory, WallKey } from "@/lib/schema";
import type { CompanionPresence } from "@/lib/llm/prompts";
import { MemoryFrame } from "./MemoryFrame";
import { presenceToEnvironment } from "./presence-utils";
import { WallShader } from "./WallShader";
import { computeWallPatina, getGhostLayers, computeMemoryGlowCenter } from "@/lib/patina/wall-patina";
import { getRoomLighting } from "@/lib/scene/lighting";
import {
  createPlasterTexture,
  createWoodFloorTexture,
  createWallRoughnessTexture,
  createWoodRoughnessTexture,
} from "./procedural-textures";

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

  // Procedural textures (Sprint 2 rendering upgrade)
  const floorTexture = useMemo(() => createWoodFloorTexture(), []);
  const floorRoughness = useMemo(() => createWoodRoughnessTexture(), []);
  const ceilingTexture = useMemo(() => createPlasterTexture("#F4E9D8", { variation: 0.02, grain: 0.01 }), []);
  const ceilingRoughness = useMemo(() => createWallRoughnessTexture(), []);

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

      {/* Floor — wood planks with PBR texture */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[ROOM_W, ROOM_D]} />
        <meshStandardMaterial
          map={floorTexture}
          roughnessMap={floorRoughness}
          roughness={0.75}
          metalness={0.05}
        />
      </mesh>

      {/* Ceiling — plaster with subtle texture */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, ROOM_H, 0]}>
        <planeGeometry args={[ROOM_W, ROOM_D]} />
        <meshStandardMaterial
          map={ceilingTexture}
          roughnessMap={ceilingRoughness}
          roughness={0.9}
          metalness={0}
        />
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

      {/* Window on the south wall (behind viewer) — warm afternoon light */}
      <Window position={[0, 1.5, ROOM_D / 2 - 0.06]} />

      {/* Area rug in front of couch */}
      <Rug position={[-1.0, 0, 1.2]} />

      {/* Side table next to the couch */}
      <SideTable position={[-2.7, 0, 0.3]} />

      {/* Floor lamp in the corner — warm fill light */}
      <FloorLamp position={[-2.7, 0, -2.0]} />

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
      {/* Base seat — wider, lower, with rounded edges via scaled boxes */}
      <mesh position={[0, 0.32, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.4, 0.55, 1.0]} />
        <meshStandardMaterial color="#8a6a55" roughness={0.85} metalness={0.02} />
      </mesh>
      {/* Back rest — angled slightly */}
      <mesh position={[0, 0.85, -0.38]} rotation={[0.12, 0, 0]} castShadow>
        <boxGeometry args={[2.4, 0.8, 0.22]} />
        <meshStandardMaterial color="#7a5c49" roughness={0.88} metalness={0.02} />
      </mesh>
      {/* Arm rests */}
      <mesh position={[-1.15, 0.55, 0]} castShadow>
        <boxGeometry args={[0.18, 0.7, 1.0]} />
        <meshStandardMaterial color="#7a5c49" roughness={0.88} metalness={0.02} />
      </mesh>
      <mesh position={[1.15, 0.55, 0]} castShadow>
        <boxGeometry args={[0.18, 0.7, 1.0]} />
        <meshStandardMaterial color="#7a5c49" roughness={0.88} metalness={0.02} />
      </mesh>
      {/* Seat cushions — two plump cushions with slight gap */}
      <mesh position={[-0.55, 0.68, 0.08]} castShadow>
        <boxGeometry args={[1.05, 0.22, 0.82]} />
        <meshStandardMaterial color="#a0806b" roughness={0.78} metalness={0.02} />
      </mesh>
      <mesh position={[0.55, 0.68, 0.08]} castShadow>
        <boxGeometry args={[1.05, 0.22, 0.82]} />
        <meshStandardMaterial color="#a0806b" roughness={0.78} metalness={0.02} />
      </mesh>
      {/* Back cushions — softer looking */}
      <mesh position={[-0.55, 0.85, -0.25]} castShadow>
        <boxGeometry args={[1.0, 0.5, 0.18]} />
        <meshStandardMaterial color="#9a7a65" roughness={0.82} metalness={0.02} />
      </mesh>
      <mesh position={[0.55, 0.85, -0.25]} castShadow>
        <boxGeometry args={[1.0, 0.5, 0.18]} />
        <meshStandardMaterial color="#9a7a65" roughness={0.82} metalness={0.02} />
      </mesh>
      {/* Legs — small dark feet */}
      {[
        [-1.1, -0.95], [1.1, -0.95], [-1.1, 0.45], [1.1, 0.45],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.05, z]} castShadow>
          <cylinderGeometry args={[0.04, 0.05, 0.1, 8]} />
          <meshStandardMaterial color="#3a2818" roughness={0.6} metalness={0.1} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Window — a framed window on the south wall with light streaming in.
 * The light creates a warm glow pattern on the floor.
 */
function Window({ position }: { position: [number, number, number] }) {
  const frameColor = "#5a4030";
  const winW = 2.0;
  const winH = 1.6;
  const frameW = 0.08;

  return (
    <group position={position}>
      {/* Window frame — 4 pieces */}
      <mesh position={[0, winH / 2, 0]} castShadow>
        <boxGeometry args={[winW + frameW * 2, frameW, 0.1]} />
        <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.05} />
      </mesh>
      <mesh position={[0, -winH / 2, 0]} castShadow>
        <boxGeometry args={[winW + frameW * 2, frameW, 0.1]} />
        <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.05} />
      </mesh>
      <mesh position={[-winW / 2 - frameW / 2, 0, 0]} castShadow>
        <boxGeometry args={[frameW, winH, 0.1]} />
        <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.05} />
      </mesh>
      <mesh position={[winW / 2 + frameW / 2, 0, 0]} castShadow>
        <boxGeometry args={[frameW, winH, 0.1]} />
        <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.05} />
      </mesh>
      {/* Cross divider */}
      <mesh position={[0, 0, 0.01]}>
        <boxGeometry args={[frameW * 0.7, winH, 0.06]} />
        <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.05} />
      </mesh>
      <mesh position={[0, 0, 0.01]}>
        <boxGeometry args={[winW, frameW * 0.7, 0.06]} />
        <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.05} />
      </mesh>
      {/* Glass — warm translucent, like afternoon light */}
      <mesh position={[0, 0, 0.02]}>
        <planeGeometry args={[winW - 0.05, winH - 0.05]} />
        <meshStandardMaterial
          color="#FFE8C0"
          transparent
          opacity={0.25}
          emissive="#FFD9A0"
          emissiveIntensity={0.4}
          roughness={0.1}
          metalness={0}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

/**
 * Rug — a soft textured area rug on the floor in front of the couch.
 */
function Rug({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Main rug body */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <planeGeometry args={[3.0, 2.0]} />
        <meshStandardMaterial color="#9a7a5a" roughness={0.95} metalness={0} />
      </mesh>
      {/* Border pattern */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <ringGeometry args={[1.2, 1.25, 32]} />
        <meshStandardMaterial color="#8a6a4a" roughness={0.9} metalness={0} />
      </mesh>
      {/* Center medallion */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.013, 0]}>
        <ringGeometry args={[0.3, 0.5, 6]} />
        <meshStandardMaterial color="#7a5a3a" roughness={0.9} metalness={0} />
      </mesh>
    </group>
  );
}

/**
 * Side table — a small round table next to the couch.
 */
function SideTable({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Tabletop */}
      <mesh position={[0, 0.55, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.3, 0.04, 16]} />
        <meshStandardMaterial color="#4a3525" roughness={0.5} metalness={0.1} />
      </mesh>
      {/* Stem */}
      <mesh position={[0, 0.28, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 0.55, 8]} />
        <meshStandardMaterial color="#3a2818" roughness={0.5} metalness={0.1} />
      </mesh>
      {/* Base */}
      <mesh position={[0, 0.02, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.2, 0.03, 16]} />
        <meshStandardMaterial color="#3a2818" roughness={0.5} metalness={0.1} />
      </mesh>
    </group>
  );
}

/**
 * Floor lamp — warm light source in the corner.
 */
function FloorLamp({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Base */}
      <mesh position={[0, 0.03, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.18, 0.06, 16]} />
        <meshStandardMaterial color="#3a2818" roughness={0.5} metalness={0.1} />
      </mesh>
      {/* Stem */}
      <mesh position={[0, 0.8, 0]} castShadow>
        <cylinderGeometry args={[0.02, 0.025, 1.55, 8]} />
        <meshStandardMaterial color="#3a2818" roughness={0.5} metalness={0.1} />
      </mesh>
      {/* Lamp shade */}
      <mesh position={[0, 1.6, 0]} castShadow>
        <coneGeometry args={[0.25, 0.3, 16, 1, true]} />
        <meshStandardMaterial
          color="#F0D8A0"
          roughness={0.8}
          metalness={0}
          emissive="#FFD080"
          emissiveIntensity={0.6}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      {/* Actual light source */}
      <pointLight position={[0, 1.5, 0]} intensity={0.4} color="#FFD080" distance={4} decay={2} />
    </group>
  );
}