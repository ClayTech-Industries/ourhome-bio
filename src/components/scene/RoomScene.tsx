"use client";

/**
 * RoomScene — renders the 3D furniture for any room type.
 *
 * Loads the appropriate GLB model from Blender based on room type.
 * Falls back to Living Room furniture if no specific model exists.
 *
 * Living Room: couch.glb + sidetable.glb + floorlamp.glb + window.glb (in LivingRoom.tsx)
 * Study: study.glb (desk, bookshelf, books, armchair, reading lamp)
 * Bedroom: bedroom.glb (bed, pillows, nightstand, bedside lamp)
 * Garden: garden.glb (bench, plants, tree, stone path)
 */

import { Suspense, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { RoomType } from "@/lib/schema";

interface RoomSceneProps {
  roomType: RoomType;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
}

function ModelLoader({ path, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1] }: {
  path: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
}) {
  const { scene } = useGLTF(path);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  return <primitive object={cloned} position={position} rotation={rotation} scale={scale} />;
}

const ROOM_MODELS: Partial<Record<RoomType, string>> = {
  study: "/models/study.glb",
  bedroom: "/models/bedroom.glb",
  garden: "/models/garden.glb",
};

// Preload all room models
useGLTF.preload("/models/study.glb");
useGLTF.preload("/models/bedroom.glb");
useGLTF.preload("/models/garden.glb");

export function RoomScene({ roomType, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1] }: RoomSceneProps) {
  const modelPath = ROOM_MODELS[roomType];
  const isGarden = roomType === "garden";

  if (!modelPath) {
    // Living Room and Kitchen use their own component (LivingRoom.tsx)
    // Children's Room not yet built — show empty room
    return null;
  }

  return (
    <Suspense fallback={null}>
      {/* Room shell: floor, ceiling, and 4 walls (skip for garden — it's outdoor) */}
      {!isGarden && <RoomShell roomType={roomType} />}

      {/* Furniture from Blender GLB */}
      <ModelLoader path={modelPath} position={position} rotation={rotation} scale={scale} />
    </Suspense>
  );
}

/**
 * RoomShell — walls, floor, and ceiling for GLB rooms.
 * The GLB models only contain furniture, so we need to build the
 * room enclosure around them. Garden has no shell (outdoor).
 */
type LightPreset = {
  ambient: string; ambientI: number; dir: string; dirI: number; point: string; pointI: number;
};

function RoomShell({ roomType }: { roomType: RoomType }) {
  const ROOM_W = 6;
  const ROOM_D = 6;
  const ROOM_H = 3.2;

  // Wall colors based on room type
  const wallColors: Partial<Record<RoomType, string>> = {
    study: "#3a2a20",
    bedroom: "#2a1f1a",
    children: "#d4c8b8",
  };
  const wallColor = wallColors[roomType] ?? "#E8D5B7";

  // Lighting per room
  const lightingPresets: Record<string, LightPreset> = {
    study: { ambient: "#FFD9B0", ambientI: 0.35, dir: "#FF9A6A", dirI: 0.6, point: "#FFB080", pointI: 0.8 },
    bedroom: { ambient: "#3A2A1F", ambientI: 0.15, dir: "#5A4030", dirI: 0.2, point: "#D49560", pointI: 1.2 },
    children: { ambient: "#d4c8b8", ambientI: 0.25, dir: "#FFD9A8", dirI: 0.4, point: "#FFC58A", pointI: 0.6 },
  };
  const light = lightingPresets[roomType] ?? lightingPresets.study!;

  return (
    <group>
      {/* Lighting */}
      <ambientLight intensity={light.ambientI} color={light.ambient} />
      <directionalLight position={[4, 6, 3]} intensity={light.dirI} color={light.dir} castShadow />
      <pointLight position={[0, 2, -2]} intensity={light.pointI} color={light.point} distance={10} />

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[ROOM_W, ROOM_D]} />
        <meshStandardMaterial color="#6b4f3a" roughness={0.85} />
      </mesh>

      {/* Ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, ROOM_H, 0]}>
        <planeGeometry args={[ROOM_W, ROOM_D]} />
        <meshStandardMaterial color="#F4E9D8" roughness={1} />
      </mesh>

      {/* North wall */}
      <mesh position={[0, ROOM_H / 2, -ROOM_D / 2]} receiveShadow>
        <planeGeometry args={[ROOM_W, ROOM_H]} />
        <meshStandardMaterial color={wallColor} roughness={0.92} />
      </mesh>

      {/* South wall */}
      <mesh position={[0, ROOM_H / 2, ROOM_D / 2]} rotation={[0, Math.PI, 0]} receiveShadow>
        <planeGeometry args={[ROOM_W, ROOM_H]} />
        <meshStandardMaterial color={wallColor} roughness={0.92} />
      </mesh>

      {/* West wall */}
      <mesh position={[-ROOM_W / 2, ROOM_H / 2, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[ROOM_D, ROOM_H]} />
        <meshStandardMaterial color={wallColor} roughness={0.92} />
      </mesh>

      {/* East wall */}
      <mesh position={[ROOM_W / 2, ROOM_H / 2, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[ROOM_D, ROOM_H]} />
        <meshStandardMaterial color={wallColor} roughness={0.92} />
      </mesh>
    </group>
  );
}