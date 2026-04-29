"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { Suspense } from "react";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

export function SceneCanvas({ children }: Props) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, toneMappingExposure: 1.1 }}
      style={{ background: "linear-gradient(180deg, #1a0f0a 0%, #2b1a10 100%)" }}
    >
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
      <Suspense fallback={null}>{children}</Suspense>
    </Canvas>
  );
}
