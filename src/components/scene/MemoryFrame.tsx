"use client";

/**
 * A single memory on the wall — a framed luminous rectangle.
 *
 * Upgraded for Sprint 2 with proper picture frame geometry:
 *  - Beveled frame molding (not a flat box)
 *  - Inner mat/bevel like a real framed photo
 *  - Glass-like front panel with subtle reflection
 *  - Glow emanates from within, not just emissive flat color
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
  const glass = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const [progress, setProgress] = useState(justPlaced ? 0 : 1);

  useEffect(() => {
    if (!justPlaced) return;
    const start = performance.now();
    const duration = 800;
    let raf = 0;
    const tick = () => {
      const t = Math.min(1, (performance.now() - start) / duration);
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

    // Glass reflection shimmer
    if (glass.current) {
      const glassMat = glass.current.material as THREE.MeshStandardMaterial;
      glassMat.opacity = 0.06 + 0.03 * Math.sin(t * 0.7);
    }
  });

  const scale = progress * (hovered ? 1.06 : 1);

  // Patina computation
  const ageMs = Date.now() - new Date(memory.createdAt).getTime();
  const daysOld = Math.min(1, ageMs / (1000 * 60 * 60 * 24 * 30));
  const accessFactor = Math.min(1, memory.accessCount / 10);
  const storedPatina = memory.patina ?? 0;
  const dynamicPatina = Math.min(1, (storedPatina * 0.5) + (daysOld * 0.4) - (accessFactor * 0.3));
  const objectPatina = object.visualState?.patina ?? 0;
  const patina = Math.min(1, dynamicPatina + objectPatina);

  // Frame colors age toward warm sepia
  const frameColor = new THREE.Color("#3a2818").lerp(new THREE.Color("#6b5338"), patina);
  const innerColor = new THREE.Color("#FFE6B5").lerp(new THREE.Color("#C9B896"), patina);
  const matColor = new THREE.Color("#F5EDD8").lerp(new THREE.Color("#D4C8A8"), patina);

  // Emotional valence tints emissive
  const valence = memory.emotionalValence ?? 0;
  const positiveEmissive = new THREE.Color("#FFCE88");
  const negativeEmissive = new THREE.Color("#8A9BA8");
  const baseEmissive = positiveEmissive.lerp(negativeEmissive, Math.max(0, -valence * 0.5));
  const emissive = baseEmissive.lerp(new THREE.Color("#A07042"), patina);

  // Frame dimensions — wider molding for a proper picture frame look
  const frameW = 0.6;
  const frameH = 0.75;
  const depth = 0.05;
  const moldingWidth = 0.06;  // width of the wooden frame border
  const matInset = 0.04;      // mat (cardboard border) inside the frame
  const innerW = frameW - moldingWidth * 2;
  const innerH = frameH - moldingWidth * 2;

  return (
    <group
      ref={group}
      position={[object.position.x, object.position.y, object.position.z]}
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
      {/* --- Frame molding: 4 pieces forming a real picture frame --- */}
      {/* Top */}
      <mesh castShadow position={[0, (frameH - moldingWidth) / 2, 0]}>
        <boxGeometry args={[frameW, moldingWidth, depth]} />
        <meshStandardMaterial color={frameColor} roughness={0.55} metalness={0.05} />
      </mesh>
      {/* Bottom */}
      <mesh castShadow position={[0, -(frameH - moldingWidth) / 2, 0]}>
        <boxGeometry args={[frameW, moldingWidth, depth]} />
        <meshStandardMaterial color={frameColor} roughness={0.55} metalness={0.05} />
      </mesh>
      {/* Left */}
      <mesh castShadow position={[-(frameW - moldingWidth) / 2, 0, 0]}>
        <boxGeometry args={[moldingWidth, frameH - moldingWidth * 2, depth]} />
        <meshStandardMaterial color={frameColor} roughness={0.55} metalness={0.05} />
      </mesh>
      {/* Right */}
      <mesh castShadow position={[(frameW - moldingWidth) / 2, 0, 0]}>
        <boxGeometry args={[moldingWidth, frameH - moldingWidth * 2, depth]} />
        <meshStandardMaterial color={frameColor} roughness={0.55} metalness={0.05} />
      </mesh>

      {/* --- Mat (cardboard border inside frame) --- */}
      <mesh position={[0, 0, depth / 2 - 0.005]}>
        <planeGeometry args={[innerW, innerH]} />
        <meshStandardMaterial color={matColor} roughness={0.9} metalness={0} side={THREE.DoubleSide} />
      </mesh>

      {/* --- Inner luminous panel (the memory glow) --- */}
      <mesh ref={inner} position={[0, 0, depth / 2 + 0.001]}>
        <planeGeometry args={[innerW - matInset * 2, innerH - matInset * 2]} />
        <meshStandardMaterial
          color={innerColor}
          emissive={emissive}
          emissiveIntensity={0.5}
          roughness={0.4}
          toneMapped={false}
        />
      </mesh>

      {/* --- Glass front panel (subtle reflection) --- */}
      <mesh ref={glass} position={[0, 0, depth / 2 + 0.003]}>
        <planeGeometry args={[innerW, innerH]} />
        <meshStandardMaterial
          color="#FFFFFF"
          transparent
          opacity={0.06}
          roughness={0.05}
          metalness={0.1}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* --- Title label (thin warm line at bottom of frame) --- */}
      <mesh position={[0, -frameH / 2 - 0.035, depth / 2]}>
        <planeGeometry args={[innerW * 0.7, 0.018]} />
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