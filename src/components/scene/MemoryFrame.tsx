"use client";

/**
 * A single memory on the wall — a framed luminous rectangle.
 *
 * Behavior:
 *  - on mount (if justPlaced), scale up from 0 with a soft bounce
 *  - gentle pulse in emissive intensity
 *  - brighter glow when highlighted
 *  - hover: cursor change + subtle scale
 */

import { useFrame } from "@react-three/fiber";
import { useRef, useState, useEffect } from "react";
import * as THREE from "three";
import type { Memory, MemoryObject } from "@/lib/schema";

interface Props {
  object: MemoryObject;
  memory: Memory;
  highlighted: boolean;
  justPlaced: boolean;
  onClick?: () => void;
}

export function MemoryFrame({ object, memory, highlighted, justPlaced, onClick }: Props) {
  const group = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const [progress, setProgress] = useState(justPlaced ? 0 : 1);

  useEffect(() => {
    if (!justPlaced) return;
    const start = performance.now();
    const duration = 800;
    let raf = 0;
    const tick = () => {
      const t = Math.min(1, (performance.now() - start) / duration);
      // easeOutBack-ish
      const eased = 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);
      setProgress(Math.max(0, Math.min(1, eased)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [justPlaced]);

  useFrame(({ clock }) => {
    if (!inner.current) return;
    const t = clock.elapsedTime;
    const base = object.visualState?.glow ?? 0.5;
    const pulse = 0.08 * Math.sin(t * 1.2 + object.position.x * 1.7);
    const target = (highlighted ? 1.6 : hovered ? 1.1 : base) + pulse;
    const mat = inner.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity, target, 0.08);
  });

  const scale = progress * (hovered ? 1.06 : 1);
  const patina = object.visualState?.patina ?? 0;
  const frameColor = new THREE.Color("#2a1f18").lerp(new THREE.Color("#6b5338"), patina);
  const innerColor = new THREE.Color("#FFE6B5").lerp(new THREE.Color("#D9B887"), patina);
  const emissive = new THREE.Color("#FFCE88").lerp(new THREE.Color("#A07042"), patina);

  const frameW = 0.55;
  const frameH = 0.7;
  const depth = 0.04;

  return (
    <group
      ref={group}
      position={[object.position.x, object.position.y, object.position.z]}
      // East wall faces west (-x), so frames face the viewer from the right wall
      rotation={[0, -Math.PI / 2, 0]}
      scale={scale}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "default";
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      {/* Outer frame */}
      <mesh castShadow>
        <boxGeometry args={[frameW, frameH, depth]} />
        <meshStandardMaterial color={frameColor} roughness={0.6} />
      </mesh>
      {/* Inner luminous panel — stands slightly proud of the frame */}
      <mesh ref={inner} position={[0, 0, depth / 2 + 0.001]}>
        <planeGeometry args={[frameW - 0.08, frameH - 0.08]} />
        <meshStandardMaterial
          color={innerColor}
          emissive={emissive}
          emissiveIntensity={0.5}
          roughness={0.5}
          toneMapped={false}
        />
      </mesh>
      {/* Title label (sub-frame) — thin stroke of warm color */}
      <mesh position={[0, -frameH / 2 - 0.04, depth / 2]}>
        <planeGeometry args={[frameW - 0.08, 0.02]} />
        <meshStandardMaterial
          color="#FFB86B"
          emissive="#FFB86B"
          emissiveIntensity={highlighted ? 1.2 : 0.4}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
