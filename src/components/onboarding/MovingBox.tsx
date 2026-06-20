"use client";

/**
 * MovingBox — a 3D cardboard box in the Living Room.
 *
 * New occupants unpack these. Click to open, pull out an item,
 * tell the story, and place it in a room.
 *
 * The box sits on the floor. When opened, the lid lifts slightly
 * and the items inside become visible/clickable.
 */

import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { MovingBox as MovingBoxType } from "@/lib/onboarding/unpack";

interface MovingBoxProps {
  box: MovingBoxType;
  onOpen: (boxId: string) => void;
  opened: boolean;
}

export function MovingBox({ box, onOpen, opened }: MovingBoxProps) {
  const lidRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const lidLift = useRef(0);

  useFrame(() => {
    if (!lidRef.current) return;
    const target = opened ? 0.3 : 0;
    lidLift.current += (target - lidLift.current) * 0.08;
    lidRef.current.position.y = 0.35 + lidLift.current;
    lidRef.current.rotation.x = -lidLift.current * 0.8;
  });

  const boxColor = "#B89060";
  const lidColor = "#A08050";

  return (
    <group position={[box.position.x, box.position.y, box.position.z]}>
      {/* Box body */}
      <mesh
        castShadow
        receiveShadow
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = "default"; }}
        onClick={(e) => { e.stopPropagation(); if (!opened) onOpen(box.id); }}
      >
        <boxGeometry args={[0.5, 0.35, 0.5]} />
        <meshStandardMaterial
          color={hovered && !opened ? "#D4A870" : boxColor}
          roughness={0.9}
          metalness={0}
        />
      </mesh>

      {/* Box lid (lifts when opened) */}
      <group ref={lidRef} position={[0, 0.35, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.52, 0.04, 0.52]} />
          <meshStandardMaterial color={lidColor} roughness={0.9} metalness={0} />
        </mesh>
      </group>

      {/* Label */}
      {!opened && (
        <mesh position={[0, 0.15, 0.26]}>
          <planeGeometry args={[0.3, 0.08]} />
          <meshStandardMaterial
            color="#E8D5B7"
            roughness={0.8}
            transparent
            opacity={0.8}
          />
        </mesh>
      )}

      {/* Items visible when opened */}
      {opened && box.items.map((itemId, i) => {
        const x = -0.1 + (i % 2) * 0.15;
        const y = 0.08;
        const z = -0.1 + Math.floor(i / 2) * 0.15;
        return (
          <mesh key={itemId} position={[x, y, z]} castShadow>
            <boxGeometry args={[0.08, 0.08, 0.08]} />
            <meshStandardMaterial color="#D4A882" roughness={0.6} />
          </mesh>
        );
      })}
    </group>
  );
}