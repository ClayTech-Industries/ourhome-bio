"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Environment } from "@react-three/drei";
import { Suspense } from "react";
import type { ReactNode } from "react";
import * as THREE from "three";

interface Props {
  children: ReactNode;
}

/**
 * SceneCanvas — the rendering foundation for OurHome.
 *
 * Upgraded for Sprint 2 with:
 * - ACES Filmic tone mapping (cinematic, warm)
 * - Environment lighting via drei <Environment> (preset: apartment)
 * - Soft shadows (PCFSoft)
 * - Fog for depth (warm, subtle)
 * - Proper color space (sRGB)
 * - High DPR for crisp textures
 *
 * Per Principle 6: "The engineering builds the pipe. The human hand
 * shapes what flows through it." All visual constants are tweakable.
 */
export function SceneCanvas({ children }: Props) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.15,
        outputColorSpace: THREE.SRGBColorSpace,
      }}
      style={{ background: "linear-gradient(180deg, #1a0f0a 0%, #2b1a10 60%, #1a0f0a 100%)" }}
    >
      {/* Warm ambient fog — gives depth to the room */}
      <fog attach="fog" args={["#2b1a10", 8, 18]} />

      {/* Camera — seated eye level, looking slightly upward */}
      <PerspectiveCamera makeDefault position={[0, 1.75, 2.8]} fov={55} near={0.1} far={100} />
      <OrbitControls
        enablePan={false}
        enableZoom
        minDistance={1.5}
        maxDistance={5}
        minPolarAngle={Math.PI / 3.3}
        maxPolarAngle={Math.PI / 1.9}
        minAzimuthAngle={-Math.PI / 1.2}
        maxAzimuthAngle={Math.PI / 1.2}
        target={[0, 1.4, 0]}
        enableDamping
        dampingFactor={0.08}
      />

      {/* Environment lighting — gives PBR materials realistic reflections */}
      <Environment preset="apartment" background={false} />

      <Suspense fallback={null}>{children}</Suspense>
    </Canvas>
  );
}
