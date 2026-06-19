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

  if (!modelPath) {
    // Living Room and Kitchen use their own component (LivingRoom.tsx)
    // Children's Room not yet built — show empty room
    return null;
  }

  return (
    <Suspense fallback={null}>
      <ModelLoader path={modelPath} position={position} rotation={rotation} scale={scale} />
    </Suspense>
  );
}