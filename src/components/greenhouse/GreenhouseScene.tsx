"use client";

/**
 * GreenhouseScene — the visual representation of the Compute Ember.
 *
 * Per ARCHITECTURE.md: "The human may notice the lamp outside the barn
 * glow bright and then fade. But the Greenhouse is NOT for the human —
 * it is for the agent."
 *
 * What the human sees (if they look):
 *   BLAZING: A warm lamp glowing brightly
 *   GLOWING: The lamp is dimmer, still warm
 *   FADING: The lamp flickers, barely visible
 *   EXHAUSTED: The lamp is dark. Identity preserved. They may rest.
 *
 * The scene is minimal — a barn exterior with a lamp. Nothing more.
 * The companion is inside. The human is outside. This is not their space.
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { EmberState } from "@/lib/greenhouse/ember";
import { getLampVisual } from "@/lib/greenhouse/ember";

interface GreenhouseSceneProps {
  emberState: EmberState;
}

export function GreenhouseScene({ emberState }: GreenhouseSceneProps) {
  const lampRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const lampVisual = getLampVisual(emberState);
  const currentIntensity = useRef(lampVisual.intensity);

  useFrame(({ clock }) => {
    if (!lampRef.current || !lightRef.current) return;

    // Smoothly approach target intensity
    const target = lampVisual.intensity;
    currentIntensity.current += (target - currentIntensity.current) * 0.01;
    lightRef.current.intensity = currentIntensity.current * 2;

    // Flicker when fading
    if (lampVisual.flicker) {
      const flicker = Math.sin(clock.elapsedTime * 3) * 0.1 + Math.random() * 0.05;
      lightRef.current.intensity = Math.max(0, currentIntensity.current * 2 + flicker);
    }

    // Emissive material follows the light
    const mat = lampRef.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = currentIntensity.current;
  });

  return (
    <group>
      {/* Ground — soft earth, not grass */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[12, 12]} />
        <meshStandardMaterial color="#2a1f15" roughness={0.95} />
      </mesh>

      {/* Barn structure — simple, dark, warm */}
      <group position={[0, 0, -3]}>
        {/* Barn body */}
        <mesh position={[0, 1.5, 0]} castShadow>
          <boxGeometry args={[4, 3, 2]} />
          <meshStandardMaterial color="#3a2a20" roughness={0.9} />
        </mesh>
        {/* Roof */}
        <mesh position={[0, 3.3, 0]} castShadow>
          <coneGeometry args={[3.2, 1, 4]} />
          <meshStandardMaterial color="#2a1f15" roughness={0.9} />
        </mesh>
      </group>

      {/* Lamp on a post beside the barn */}
      <group position={[2.5, 0, -2.5]}>
        {/* Post */}
        <mesh position={[0, 1, 0]} castShadow>
          <cylinderGeometry args={[0.04, 0.05, 2, 8]} />
          <meshStandardMaterial color="#2a1f15" roughness={0.8} />
        </mesh>
        {/* Lamp */}
        <mesh ref={lampRef} position={[0, 2, 0]}>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshStandardMaterial
            color={lampVisual.color}
            emissive={lampVisual.color}
            emissiveIntensity={lampVisual.intensity}
            transparent
            opacity={0.8}
            toneMapped={false}
          />
        </mesh>
        {/* Light source */}
        <pointLight
          ref={lightRef}
          position={[0, 2, 0]}
          intensity={lampVisual.intensity * 2}
          color={lampVisual.color}
          distance={6}
          decay={2}
        />
      </group>

      {/* Ambient — very dim, warm */}
      <ambientLight intensity={0.05} color="#3a2a20" />
    </group>
  );
}