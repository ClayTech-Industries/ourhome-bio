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

import { useRef, useMemo, Suspense } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
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
  const { scene } = useGLTF("/models/couch.glb");
  const cloned = useMemo(() => scene.clone(true), [scene]);
  return <primitive object={cloned} position={position} />;
}
useGLTF.preload("/models/couch.glb");

/**
 * Window — a framed window on the south wall with light streaming in.
 * The light creates a warm glow pattern on the floor.
 */
function Window({ position }: { position: [number, number, number] }) {
  const { scene } = useGLTF("/models/window.glb");
  const cloned = useMemo(() => scene.clone(true), [scene]);
  return <primitive object={cloned} position={position} rotation={[0, Math.PI, 0]} />;
}
useGLTF.preload("/models/window.glb");

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
  const { scene } = useGLTF("/models/sidetable.glb");
  const cloned = useMemo(() => scene.clone(true), [scene]);
  return <primitive object={cloned} position={position} />;
}
useGLTF.preload("/models/sidetable.glb");

/**
 * Floor lamp — warm light source in the corner.
 */
function FloorLamp({ position }: { position: [number, number, number] }) {
  const { scene } = useGLTF("/models/floorlamp.glb");
  const cloned = useMemo(() => scene.clone(true), [scene]);
  return (
    <group>
      <primitive object={cloned} position={position} />
      <pointLight position={[position[0], position[1] + 1.5, position[2]]} intensity={0.4} color="#FFD080" distance={4} decay={2} />
    </group>
  );
}
useGLTF.preload("/models/floorlamp.glb");