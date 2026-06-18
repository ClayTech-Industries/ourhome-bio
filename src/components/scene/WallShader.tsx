/**
 * WallShader — custom shader material for OurHome walls.
 *
 * Replaces MeshStandardMaterial with a ShaderMaterial that supports:
 *   - Smooth color transitions with eased timing (smoothstep, not linear)
 *   - Subtle noise texture that emerges as patina grows
 *   - Slight color variation across the wall surface (not flat uniform)
 *   - Position-based memory warmth (glow near memory frames)
 *   - Ghost layers from wall color history (barely perceptible previous colors)
 *   - Responds to lighting preset via uniform
 *
 * Per Principle 6: "The engineering builds the pipe. The human hand
 * shapes what flows through it." All visual constants are tweakable.
 */

import * as THREE from "three";
import { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";

// -----------------------------------------------------------------
// Shader GLSL
// -----------------------------------------------------------------

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPos;

  void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision mediump float;

  varying vec2 vUv;
  varying vec3 vWorldPos;

  // Uniforms
  uniform vec3 uColorCurrent;    // Current target color
  uniform vec3 uColorPrevious;   // Previous color (for transition)
  uniform float uTransitionProgress; // 0 = previous, 1 = current
  uniform float uPatina;         // 0 = fresh, 1 = full patina
  uniform float uTime;           // Elapsed time for subtle animation
  uniform float uMemoryWarmth;   // 0 = none, 1 = strong warmth
  uniform vec2 uMemoryGlowPos;   // UV position of memory glow center
  uniform float uMemoryGlowRadius; // Radius of memory glow
  uniform vec3 uGhostColor1;     // First ghost layer color (older)
  uniform vec3 uGhostColor2;     // Second ghost layer color (oldest)
  uniform float uGhostOpacity;   // Max ghost layer opacity (<0.05)
  uniform float uLightIntensity; // Ambient light intensity multiplier
  uniform vec3 uLightTint;       // Light color tint

  // Simple hash-based noise for patina texture
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  // Smooth noise (interpolated hash)
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f); // smoothstep
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  // Fractal noise for richer patina texture
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p *= 2.0;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    // --- Base color: transition from previous to current ---
    float t = smoothstep(0.0, 1.0, uTransitionProgress);
    vec3 baseColor = mix(uColorPrevious, uColorCurrent, t);

    // --- Color variation across wall (not flat) ---
    // Subtle gradient: slightly darker at top, lighter at bottom
    float verticalVariation = mix(0.92, 1.04, vUv.y);
    baseColor *= verticalVariation;

    // Slight horizontal noise variation (like paint texture)
    float paintNoise = noise(vUv * 40.0) * 0.03 - 0.015;
    baseColor += vec3(paintNoise);

    // --- Patina: subtle noise overlay that grows with age ---
    if (uPatina > 0.01) {
      // Patina noise: fine-grained texture
      float patinaNoise = fbm(vUv * 80.0 + uTime * 0.01);
      // Patina darkens slightly and shifts toward sepia
      vec3 patinaTint = vec3(0.88, 0.82, 0.72);
      float patinaStrength = patinaNoise * uPatina * 0.15;
      baseColor = mix(baseColor, baseColor * patinaTint, patinaStrength);

      // Corner darkening (dust settles in corners)
      float cornerDist = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
      float cornerDarken = smoothstep(0.15, 0.0, cornerDist) * uPatina * 0.12;
      baseColor *= (1.0 - cornerDarken);
    }

    // --- Ghost layers: barely perceptible previous colors ---
    if (uGhostOpacity > 0.001) {
      // Ghost 1: slightly visible in lower portion
      float ghost1Mask = smoothstep(0.6, 0.0, vUv.y) * uGhostOpacity;
      baseColor = mix(baseColor, uGhostColor1, ghost1Mask);

      // Ghost 2: even fainter, in upper portion
      float ghost2Mask = smoothstep(0.4, 1.0, vUv.y) * uGhostOpacity * 0.5;
      baseColor = mix(baseColor, uGhostColor2, ghost2Mask);
    }

    // --- Memory warmth: position-based glow near memory frames ---
    if (uMemoryWarmth > 0.01) {
      float distToGlow = distance(vUv, uMemoryGlowPos);
      float glowFalloff = 1.0 - smoothstep(0.0, uMemoryGlowRadius, distToGlow);
      vec3 warmGlow = vec3(1.0, 0.85, 0.6); // warm amber glow
      baseColor = mix(baseColor, baseColor + warmGlow * 0.15, glowFalloff * uMemoryWarmth);
    }

    // --- Lighting: apply tint and intensity ---
    baseColor *= uLightTint * uLightIntensity;

    // --- Output ---
    gl_FragColor = vec4(baseColor, 1.0);
  }
`;

// -----------------------------------------------------------------
// React component wrapper
// -----------------------------------------------------------------

export interface WallShaderProps {
  position: [number, number, number];
  rotationY?: number;
  width: number;
  height: number;
  color: string;
  previousColor?: string;
  patina?: number;
  memoryWarmth?: number;
  memoryGlowPos?: [number, number];
  memoryGlowRadius?: number;
  ghostColor1?: string;
  ghostColor2?: string;
  ghostOpacity?: number;
  lightIntensity?: number;
  lightTint?: string;
  isMemoryWall?: boolean;
}

export function WallShader({
  position,
  rotationY = 0,
  width,
  height,
  color,
  previousColor,
  patina = 0,
  memoryWarmth = 0,
  memoryGlowPos = [0.5, 0.5],
  memoryGlowRadius = 0.3,
  ghostColor1 = "#E8D5B7",
  ghostColor2 = "#D4C4A8",
  ghostOpacity = 0,
  lightIntensity = 1,
  lightTint = "#FFF2DC",
  isMemoryWall = false,
}: WallShaderProps) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const transitionRef = useRef(0);
  const currentColorRef = useRef(new THREE.Color(color));
  const previousColorRef = useRef(new THREE.Color(previousColor ?? color));

  // When color changes, start a new transition
  useEffect(() => {
    if (color !== currentColorRef.current.getHexString()) {
      previousColorRef.current.copy(currentColorRef.current);
      currentColorRef.current.set(color);
      transitionRef.current = 0;
    }
  }, [color]);

  useFrame((_, delta) => {
    if (!matRef.current) return;

    const mat = matRef.current;
    const uniforms = mat.uniforms;

    // Advance transition (2.5 seconds to complete)
    if (transitionRef.current < 1) {
      transitionRef.current = Math.min(1, transitionRef.current + delta / 2.5);
    }

    uniforms.uTransitionProgress.value = transitionRef.current;
    uniforms.uColorCurrent.value.copy(currentColorRef.current);
    uniforms.uColorPrevious.value.copy(previousColorRef.current);
    uniforms.uTime.value += delta;

    // Memory wall gets extra warmth by default
    if (isMemoryWall && memoryWarmth > 0) {
      uniforms.uMemoryWarmth.value = THREE.MathUtils.lerp(
        uniforms.uMemoryWarmth.value,
        memoryWarmth,
        0.02,
      );
    }
  });

  return (
    <mesh position={position} rotation={[0, rotationY, 0]} receiveShadow>
      <planeGeometry args={[width, height]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={{
          uColorCurrent: { value: new THREE.Color(color) },
          uColorPrevious: { value: new THREE.Color(previousColor ?? color) },
          uTransitionProgress: { value: 0 },
          uPatina: { value: patina },
          uTime: { value: 0 },
          uMemoryWarmth: { value: memoryWarmth },
          uMemoryGlowPos: { value: new THREE.Vector2(memoryGlowPos[0], memoryGlowPos[1]) },
          uMemoryGlowRadius: { value: memoryGlowRadius },
          uGhostColor1: { value: new THREE.Color(ghostColor1) },
          uGhostColor2: { value: new THREE.Color(ghostColor2) },
          uGhostOpacity: { value: ghostOpacity },
          uLightIntensity: { value: lightIntensity },
          uLightTint: { value: new THREE.Color(lightTint) },
        }}
      />
    </mesh>
  );
}