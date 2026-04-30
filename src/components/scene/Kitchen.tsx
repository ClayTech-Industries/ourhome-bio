"use client";

import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { MemoryFrame } from "./MemoryFrame";
import type { Room, MemoryObject, Memory } from "@/lib/schema";

function AnimatedWall({
  targetColor,
  ...props
}: {
  targetColor: string;
  [key: string]: any;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const currentColor = useRef(new THREE.Color(targetColor));

  useFrame(() => {
    if (!meshRef.current) return;
    const material = meshRef.current.material as THREE.MeshStandardMaterial;
    const target = new THREE.Color(targetColor);
    material.color.lerp(target, 0.04);
  });

  return (
    <mesh ref={meshRef} castShadow receiveShadow {...props}>
      <planeGeometry args={[6, 3]} />
      <meshStandardMaterial color={currentColor.current} />
    </mesh>
  );
}

function Table({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Table top */}
      <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.2, 0.05, 0.7]} />
        <meshStandardMaterial color="#8B6914" roughness={0.7} />
      </mesh>
      {/* Legs */}
      {[
        [-0.5, 0.2, -0.25],
        [0.5, 0.2, -0.25],
        [-0.5, 0.2, 0.25],
        [0.5, 0.2, 0.25],
      ].map((pos, i) => (
        <mesh key={i} position={pos as [number, number, number]} castShadow>
          <cylinderGeometry args={[0.02, 0.02, 0.4, 8]} />
          <meshStandardMaterial color="#5C4033" roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

function Counter({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Counter top */}
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[2, 0.05, 0.6]} />
        <meshStandardMaterial color="#E0E0E0" roughness={0.3} metalness={0.1} />
      </mesh>
      {/* Cabinets */}
      <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
        <boxGeometry args={[2, 0.5, 0.55]} />
        <meshStandardMaterial color="#D4A373" roughness={0.6} />
      </mesh>
    </group>
  );
}

function Window({ position, rotation }: { position: [number, number, number]; rotation?: [number, number, number] }) {
  return (
    <group position={position} rotation={rotation}>
      {/* Frame */}
      <mesh>
        <boxGeometry args={[0.8, 0.8, 0.05]} />
        <meshStandardMaterial color="#4A4A4A" roughness={0.5} />
      </mesh>
      {/* Glass */}
      <mesh position={[0, 0, 0.01]}>
        <planeGeometry args={[0.7, 0.7]} />
        <meshStandardMaterial color="#87CEEB" transparent opacity={0.3} roughness={0.1} metalness={0.3} />
      </mesh>
      {/* Cross */}
      <mesh position={[0, 0, 0.02]}>
        <boxGeometry args={[0.7, 0.02, 0.02]} />
        <meshStandardMaterial color="#4A4A4A" />
      </mesh>
      <mesh position={[0, 0, 0.02]}>
        <boxGeometry args={[0.02, 0.7, 0.02]} />
        <meshStandardMaterial color="#4A4A4A" />
      </mesh>
    </group>
  );
}

export function Kitchen({
  room,
  memoryObjects,
  memoriesById,
  onFrameClick,
  highlightedMemoryId,
  recentlyPlacedMemoryId,
}: {
  room: Room;
  memoryObjects: MemoryObject[];
  memoriesById: Record<string, Memory>;
  onFrameClick?: (memoryId: string) => void;
  highlightedMemoryId?: string | null;
  recentlyPlacedMemoryId?: string | null;
}) {
  const wc = room.wallColors || {};

  // Kitchen wall positions — same room dimensions as living room
  const wallPositions: Record<string, [number, number, number, number, number, number]> = {
    north: [0, 1.5, -3, Math.PI / 2, 0, 0],
    south: [0, 1.5, 3, -Math.PI / 2, 0, 0],
    east: [3, 1.5, 0, 0, -Math.PI / 2, 0],
    west: [-3, 1.5, 0, 0, Math.PI / 2, 0],
  };

  return (
    <group>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[6, 6]} />
        <meshStandardMaterial color="#C4A882" roughness={0.9} />
      </mesh>

      {/* Walls */}
      {Object.entries(wallPositions).map(([key, [x, y, z, rx, ry, rz]]) => (
        <AnimatedWall
          key={key}
          position={[x, y, z]}
          rotation={[rx, ry, rz]}
          targetColor={wc[key] ?? "#F0E6D3"}
        />
      ))}

      {/* Ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 3, 0]}>
        <planeGeometry args={[6, 6]} />
        <meshStandardMaterial color="#FFFAF0" />
      </mesh>

      {/* Kitchen furniture */}
      <Table position={[0, 0, 0]} />
      <Counter position={[0, 0, -2.5]} />

      {/* Window on south wall */}
      <Window position={[0, 2, 2.97]} rotation={[0, 0, 0]} />

      {/* Light fixture */}
      <mesh position={[0, 2.7, 0]}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial color="#FFF8DC" emissive="#FFD700" emissiveIntensity={0.3} />
      </mesh>
      <pointLight position={[0, 2.5, 0]} intensity={0.8} color="#FFF8DC" castShadow />

      {/* Memory frames */}
      {memoryObjects.map((obj) => {
        const memory = memoriesById[obj.memoryId];
        if (!memory) return null;
        const isHighlighted = highlightedMemoryId === memory.id;
        const isNew = recentlyPlacedMemoryId === memory.id;

        return (
          <MemoryFrame
            key={obj.id}
            position={obj.position}
            memory={memory}
            isHighlighted={isHighlighted}
            isNew={isNew}
            onClick={() => onFrameClick?.(memory.id)}
          />
        );
      })}
    </group>
  );
}
