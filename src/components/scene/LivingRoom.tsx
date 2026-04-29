"use client";

/**
 * LivingRoom — the first room.
 *
 * A simple stylized interior: four walls, a floor, soft warm light,
 * and a Memory Wall on the east side where frames accumulate.
 *
 * Rendered inside a <Canvas> (see SceneCanvas).
 */

import { useRef } from "react";
import type { Mesh } from "three";
import type { Room, MemoryObject, Memory } from "@/lib/schema";
import { MemoryFrame } from "./MemoryFrame";

interface LivingRoomProps {
  room: Room;
  memoryObjects: MemoryObject[];
  memoriesById: Record<string, Memory>;
  onFrameClick?: (memoryId: string) => void;
  highlightedMemoryId?: string | null;
  recentlyPlacedMemoryId?: string | null;
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
}: LivingRoomProps) {
  const wallColors = room.wallColors ?? {};
  const north = wallColors.north ?? "#E8D5B7";
  const south = wallColors.south ?? "#E8D5B7";
  const east = wallColors.east ?? "#C4A882"; // Memory Wall — warmer
  const west = wallColors.west ?? "#E8D5B7";
  const floorColor = "#6b4f3a";

  const intensity = room.lighting?.intensity ?? 1;

  return (
    <group>
      {/* Lighting — warm afternoon preset */}
      <ambientLight intensity={0.45 * intensity} color="#FFF2DC" />
      <directionalLight
        position={[4, 6, 3]}
        intensity={1.1 * intensity}
        color="#FFD9A8"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      {/* Warm fill from window side (south) */}
      <pointLight position={[0, 2, -2]} intensity={0.25} color="#FFC58A" distance={10} />

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

      {/* North wall (back) */}
      <Wall position={[0, ROOM_H / 2, -ROOM_D / 2]} width={ROOM_W} height={ROOM_H} color={north} />
      {/* South wall (front, behind camera) */}
      <Wall
        position={[0, ROOM_H / 2, ROOM_D / 2]}
        rotationY={Math.PI}
        width={ROOM_W}
        height={ROOM_H}
        color={south}
      />
      {/* West wall (left) */}
      <Wall
        position={[-ROOM_W / 2, ROOM_H / 2, 0]}
        rotationY={Math.PI / 2}
        width={ROOM_D}
        height={ROOM_H}
        color={west}
      />
      {/* East wall (right) — the Memory Wall */}
      <Wall
        position={[ROOM_W / 2, ROOM_H / 2, 0]}
        rotationY={-Math.PI / 2}
        width={ROOM_D}
        height={ROOM_H}
        color={east}
      />

      {/* A simple suggestion of a couch — geometric, no clutter */}
      <Couch position={[-1.6, 0, 0]} />

      {/* Memory frames on the east wall */}
      {memoryObjects.map((obj) => {
        const memory = memoriesById[obj.memoryId];
        if (!memory) return null;
        return (
          <MemoryFrame
            key={obj.id}
            object={obj}
            memory={memory}
            highlighted={highlightedMemoryId === memory.id}
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
  const ref = useRef<Mesh>(null);
  return (
    <mesh ref={ref} position={position} rotation={[0, rotationY, 0]} receiveShadow>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial color={color} roughness={0.95} />
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
