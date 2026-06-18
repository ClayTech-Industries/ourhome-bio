/**
 * Procedural Textures — generated at runtime, no external assets needed.
 *
 * Creates canvas-based textures for walls, floors, and furniture
 * that look like real materials instead of flat colors.
 *
 * Per Principle 6: "The engineering builds the pipe. The human hand
 * shapes what flows through it." Texture parameters are tweakable.
 */

import * as THREE from "three";

// -----------------------------------------------------------------
// Canvas texture helper
// -----------------------------------------------------------------

function createCanvas(size: number = 512): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
} {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  return { canvas, ctx };
}

function canvasToTexture(canvas: HTMLCanvasElement, repeat: [number, number] = [1, 1]): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat[0], repeat[1]);
  texture.needsUpdate = true;
  return texture;
}

// -----------------------------------------------------------------
// Plaster/Paint Wall Texture
// -----------------------------------------------------------------

/**
 * Generate a plaster wall texture with subtle variation.
 * Looks like painted plaster — not flat, not noisy, just... real.
 */
export function createPlasterTexture(
  baseColor: string,
  options: {
    variation?: number;   // 0-1, how much color varies across surface
    grain?: number;       // 0-1, fine grain noise
    size?: number;        // canvas resolution
  } = {},
): THREE.CanvasTexture {
  const { variation = 0.04, grain = 0.02, size = 512 } = options;
  const { canvas, ctx } = createCanvas(size);

  // Base fill
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, size, size);

  // Subtle large-scale variation (like roller marks)
  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * variation * 255;
    const fineGrain = (Math.random() - 0.5) * grain * 255;
    const totalNoise = noise + fineGrain;

    data[i] = Math.max(0, Math.min(255, data[i] + totalNoise));     // R
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + totalNoise)); // G
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + totalNoise)); // B
  }

  ctx.putImageData(imageData, 0, 0);

  // Add subtle brush strokes (very faint)
  ctx.globalAlpha = 0.03;
  for (let i = 0; i < 8; i++) {
    const y = Math.random() * size;
    const grad = ctx.createLinearGradient(0, y, size, y + (Math.random() - 0.5) * 40);
    grad.addColorStop(0, "rgba(255,255,255,0.1)");
    grad.addColorStop(0.5, "rgba(0,0,0,0.05)");
    grad.addColorStop(1, "rgba(255,255,255,0.1)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, y, size, 20 + Math.random() * 30);
  }
  ctx.globalAlpha = 1;

  return canvasToTexture(canvas, [2, 1]);
}

// -----------------------------------------------------------------
// Wood Floor Texture
// -----------------------------------------------------------------

/**
 * Generate a wood plank floor texture.
 * Warm, lived-in, with grain and subtle color variation between planks.
 */
export function createWoodFloorTexture(
  options: {
    baseColor?: string;
    plankCount?: number;
    size?: number;
  } = {},
): THREE.CanvasTexture {
  const {
    baseColor = "#6b4f3a",
    plankCount = 6,
    size = 512,
  } = options;
  const { canvas, ctx } = createCanvas(size);

  const plankHeight = size / plankCount;
  const base = new THREE.Color(baseColor);

  for (let p = 0; p < plankCount; p++) {
    const y = p * plankHeight;

    // Each plank has slightly different color
    const plankVariation = (Math.random() - 0.5) * 0.08;
    const plankColor = base.clone();
    plankColor.offsetHSL(0, 0, plankVariation);

    ctx.fillStyle = `#${plankColor.getHexString()}`;
    ctx.fillRect(0, y, size, plankHeight);

    // Wood grain lines
    ctx.globalAlpha = 0.15;
    for (let g = 0; g < 12; g++) {
      const grainY = y + Math.random() * plankHeight;
      const grainHeight = 1 + Math.random() * 3;
      ctx.fillStyle = plankVariation > 0
        ? `rgba(80, 55, 35, ${0.3 + Math.random() * 0.4})`
        : `rgba(100, 75, 50, ${0.3 + Math.random() * 0.4})`;
      ctx.fillRect(0, grainY, size, grainHeight);
    }
    ctx.globalAlpha = 1;

    // Plank gap (dark line between planks)
    ctx.fillStyle = "rgba(30, 20, 15, 0.6)";
    ctx.fillRect(0, y, size, 2);
  }

  // Subtle overall noise
  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 8;
    data[i] = Math.max(0, Math.min(255, data[i] + noise));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
  }
  ctx.putImageData(imageData, 0, 0);

  return canvasToTexture(canvas, [3, 3]);
}

// -----------------------------------------------------------------
// Roughness/Metalness maps
// -----------------------------------------------------------------

/**
 * Generate a roughness map for walls — mostly rough with slight variation.
 * Walls are not glossy — they're painted plaster.
 */
export function createWallRoughnessTexture(size: number = 256): THREE.CanvasTexture {
  const { canvas, ctx } = createCanvas(size);
  ctx.fillStyle = "#dddddd"; // fairly rough (0.87)
  ctx.fillRect(0, 0, size, size);

  // Add slight variation
  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 20;
    data[i] = Math.max(0, Math.min(255, data[i] + noise));
    data[i + 1] = data[i];
    data[i + 2] = data[i];
  }
  ctx.putImageData(imageData, 0, 0);

  return canvasToTexture(canvas, [2, 1]);
}

/**
 * Generate a roughness map for wood floors — semi-glossy in places.
 */
export function createWoodRoughnessTexture(size: number = 256): THREE.CanvasTexture {
  const { canvas, ctx } = createCanvas(size);
  ctx.fillStyle = "#888888"; // medium roughness (0.53)
  ctx.fillRect(0, 0, size, size);

  // Glossy streaks (worn varnish)
  ctx.globalAlpha = 0.2;
  for (let i = 0; i < 5; i++) {
    const y = Math.random() * size;
    ctx.fillStyle = "#cccccc";
    ctx.fillRect(0, y, size, 3 + Math.random() * 8);
  }
  ctx.globalAlpha = 1;

  return canvasToTexture(canvas, [3, 3]);
}

// -----------------------------------------------------------------
// Environment Map (procedural)
// -----------------------------------------------------------------

/**
 * Generate a simple environment map for PBR reflections.
 * Creates a warm ambient environment that makes materials look real
 * instead of flat. No HDR file needed — procedurally generated.
 */
export function createEnvironmentMap(): THREE.DataTexture {
  const size = 256;
  const data = new Uint8Array(size * size * 4);

  // Create a gradient: warm at top (ceiling light), cooler at bottom (floor)
  for (let y = 0; y < size; y++) {
    const v = y / size;
    // Top: warm bright (ceiling), Middle: warm ambient, Bottom: darker (floor)
    const r = Math.round(255 * (1.0 - v * 0.3));
    const g = Math.round(230 * (1.0 - v * 0.4));
    const b = Math.round(200 * (1.0 - v * 0.5));

    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      // Add slight horizontal variation
      const hVar = Math.sin((x / size) * Math.PI) * 10;
      data[idx] = Math.max(0, Math.min(255, r + hVar));
      data[idx + 1] = Math.max(0, Math.min(255, g + hVar));
      data[idx + 2] = Math.max(0, Math.min(255, b));
      data[idx + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.needsUpdate = true;
  texture.mapping = THREE.EquirectangularReflectionMapping;
  return texture;
}