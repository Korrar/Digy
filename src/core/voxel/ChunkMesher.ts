import * as THREE from 'three';
import { BlockType, getBlock, isTransparent, isCrossedQuad, isFlat, isSlab, isFence, isStairs, isDoor, isChest, isTorch, isLever, isButton, isCable, isPiston, isPistonHead, isSign, isPressurePlate, isDetectorRail, isRepeater, isComparator, isRailSlope, getRailSlopeDir, getRailSlopeBlock } from './BlockRegistry';
import { ChunkData } from './ChunkData';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '../../utils/constants';
import { getAtlasUV, getWhiteUV } from './TextureAtlas';

interface Face {
  dir: [number, number, number];
  corners: [number, number, number][];
  faceName: 'top' | 'bottom' | 'side';
  uvs: [number, number][];
}

const FACES: Face[] = [
  { dir: [0, 1, 0], corners: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]], faceName: 'top', uvs: [[0,0],[1,0],[1,1],[0,1]] },
  { dir: [0, -1, 0], corners: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]], faceName: 'bottom', uvs: [[0,0],[1,0],[1,1],[0,1]] },
  { dir: [1, 0, 0], corners: [[1,0,0],[1,1,0],[1,1,1],[1,0,1]], faceName: 'side', uvs: [[0,0],[0,1],[1,1],[1,0]] },
  { dir: [-1, 0, 0], corners: [[0,0,1],[0,1,1],[0,1,0],[0,0,0]], faceName: 'side', uvs: [[0,0],[0,1],[1,1],[1,0]] },
  { dir: [0, 0, 1], corners: [[1,0,1],[1,1,1],[0,1,1],[0,0,1]], faceName: 'side', uvs: [[0,0],[0,1],[1,1],[1,0]] },
  { dir: [0, 0, -1], corners: [[0,0,0],[0,1,0],[1,1,0],[1,0,0]], faceName: 'side', uvs: [[0,0],[0,1],[1,1],[1,0]] },
];

// Two crossed quads forming an X shape (diagonal planes)
const CROSSED_QUAD_FACES: { corners: [number, number, number][]; normal: [number, number, number] }[] = [
  { corners: [[0.15,0,0.15],[0.15,0.9,0.15],[0.85,0.9,0.85],[0.85,0,0.85]], normal: [-0.707,0,0.707] },
  { corners: [[0.85,0,0.85],[0.85,0.9,0.85],[0.15,0.9,0.15],[0.15,0,0.15]], normal: [0.707,0,-0.707] },
  { corners: [[0.85,0,0.15],[0.85,0.9,0.15],[0.15,0.9,0.85],[0.15,0,0.85]], normal: [0.707,0,0.707] },
  { corners: [[0.15,0,0.85],[0.15,0.9,0.85],[0.85,0.9,0.15],[0.85,0,0.15]], normal: [-0.707,0,-0.707] },
];

// Fast hash for procedural per-vertex noise (deterministic)
function hash3(x: number, y: number, z: number): number {
  let h = (x * 374761393 + y * 668265263 + z * 1274126177) | 0;
  h = ((h ^ (h >> 13)) * 1274126177) | 0;
  return (h & 0x7fffffff) / 0x7fffffff;
}


function computeAO(
  chunk: ChunkData,
  x: number, y: number, z: number,
  face: Face,
  cornerIdx: number,
  ox: number, oz: number,
  getNeighborBlock?: (wx: number, wy: number, wz: number) => BlockType
): number {
  const corner = face.corners[cornerIdx];
  const cx = x + corner[0];
  const cy = y + corner[1];
  const cz = z + corner[2];
  const dx = corner[0] * 2 - 1;
  const dy = corner[1] * 2 - 1;
  const dz = corner[2] * 2 - 1;
  let occluders = 0;

  const checks: [number, number, number][] = [];
  if (face.dir[0] !== 0) {
    checks.push([cx, y + (dy > 0 ? 1 : 0), z], [cx, y, z + (dz > 0 ? 1 : 0)], [cx, y + (dy > 0 ? 1 : 0), z + (dz > 0 ? 1 : 0)]);
  } else if (face.dir[1] !== 0) {
    checks.push([x + (dx > 0 ? 1 : 0), cy, z], [x, cy, z + (dz > 0 ? 1 : 0)], [x + (dx > 0 ? 1 : 0), cy, z + (dz > 0 ? 1 : 0)]);
  } else {
    checks.push([x + (dx > 0 ? 1 : 0), y, cz], [x, y + (dy > 0 ? 1 : 0), cz], [x + (dx > 0 ? 1 : 0), y + (dy > 0 ? 1 : 0), cz]);
  }

  for (const [px, py, pz] of checks) {
    let block: BlockType;
    if (px >= 0 && px < CHUNK_SIZE && py >= 0 && py < CHUNK_HEIGHT && pz >= 0 && pz < CHUNK_SIZE) {
      block = chunk.getBlock(px, py, pz);
    } else if (getNeighborBlock) {
      block = getNeighborBlock(ox + px, py, oz + pz);
    } else {
      block = BlockType.AIR;
    }
    if (!isTransparent(block) && block !== BlockType.AIR) {
      occluders++;
    }
  }

  return 1.0 - occluders * 0.12;
}

export type RailShape = 'ns' | 'ew' | 'curve_ne' | 'curve_nw' | 'curve_se' | 'curve_sw' | 'slope_n' | 'slope_s' | 'slope_e' | 'slope_w';

/** Map from curve block type to RailShape */
const CURVE_BLOCK_TO_SHAPE: Partial<Record<BlockType, RailShape>> = {
  [BlockType.RAIL_CURVE_NE]: 'curve_ne',
  [BlockType.RAIL_CURVE_NW]: 'curve_nw',
  [BlockType.RAIL_CURVE_SE]: 'curve_se',
  [BlockType.RAIL_CURVE_SW]: 'curve_sw',
  [BlockType.RAIL_SLOPE_N]: 'slope_n',
  [BlockType.RAIL_SLOPE_S]: 'slope_s',
  [BlockType.RAIL_SLOPE_E]: 'slope_e',
  [BlockType.RAIL_SLOPE_W]: 'slope_w',
};

/** Map from RailShape to curve block type */
export const SHAPE_TO_CURVE_BLOCK: Partial<Record<RailShape, BlockType>> = {
  'curve_ne': BlockType.RAIL_CURVE_NE,
  'curve_nw': BlockType.RAIL_CURVE_NW,
  'curve_se': BlockType.RAIL_CURVE_SE,
  'curve_sw': BlockType.RAIL_CURVE_SW,
};

/**
 * Get the rail shape for rendering. Uses stored block type directly.
 * Curve block types (RAIL_CURVE_*) return their stored shape.
 * Straight rails (RAIL, RAIL_EW) and powered rails compute from neighbors.
 */
export function computeRailShape(
  getBlockAt: (x: number, y: number, z: number) => BlockType,
  x: number, y: number, z: number
): RailShape | null {
  const block = getBlockAt(x, y, z);
  if (!isFlat(block)) return null;

  // Curve/slope block types: return stored shape directly (like Minecraft)
  const storedCurve = CURVE_BLOCK_TO_SHAPE[block];
  if (storedCurve) return storedCurve;

  const isPowered = block === BlockType.POWERED_RAIL;

  const hasNorth = isFlat(getBlockAt(x, y, z - 1));
  const hasSouth = isFlat(getBlockAt(x, y, z + 1));
  const hasEast = isFlat(getBlockAt(x + 1, y, z));
  const hasWest = isFlat(getBlockAt(x - 1, y, z));

  // Powered rails: always straight, never curve
  if (isPowered) {
    if ((hasEast || hasWest) && !hasNorth && !hasSouth) return 'ew';
    return 'ns';
  }

  const count = (hasNorth ? 1 : 0) + (hasSouth ? 1 : 0) + (hasEast ? 1 : 0) + (hasWest ? 1 : 0);

  // 2 opposite neighbors: always straight
  if (count >= 2) {
    if (hasNorth && hasSouth) return 'ns';
    if (hasEast && hasWest) return 'ew';
  }

  // 2 perpendicular neighbors: always curve
  if (count === 2) {
    if (hasSouth && hasEast) return 'curve_se';
    if (hasSouth && hasWest) return 'curve_sw';
    if (hasNorth && hasEast) return 'curve_ne';
    return 'curve_nw';
  }

  // 1 neighbor: extend in that direction
  if (count === 1) {
    if (hasEast || hasWest) return 'ew';
    return 'ns';
  }

  // 0 neighbors: use stored block type for orientation
  if (block === BlockType.RAIL_EW) return 'ew';
  return 'ns';
}

/**
 * Get the two connection directions for a rail block type.
 * Returns [[dx1, dz1], [dx2, dz2]] where dx/dz are -1, 0, or 1.
 * North = [0,-1], South = [0,1], East = [1,0], West = [-1,0]
 */
export function getRailConnections(blockType: BlockType): [number, number][] {
  switch (blockType) {
    case BlockType.RAIL:           return [[0, -1], [0, 1]];  // N, S
    case BlockType.RAIL_EW:        return [[1, 0], [-1, 0]];  // E, W
    case BlockType.RAIL_CURVE_NE:  return [[0, -1], [1, 0]];  // N, E
    case BlockType.RAIL_CURVE_NW:  return [[0, -1], [-1, 0]]; // N, W
    case BlockType.RAIL_CURVE_SE:  return [[0, 1], [1, 0]];   // S, E
    case BlockType.RAIL_CURVE_SW:  return [[0, 1], [-1, 0]];  // S, W
    case BlockType.RAIL_SLOPE_N:   return [[0, -1], [0, 1]];  // N, S (ascending north)
    case BlockType.RAIL_SLOPE_S:   return [[0, -1], [0, 1]];  // N, S (ascending south)
    case BlockType.RAIL_SLOPE_E:   return [[1, 0], [-1, 0]];  // E, W (ascending east)
    case BlockType.RAIL_SLOPE_W:   return [[1, 0], [-1, 0]];  // E, W (ascending west)
    case BlockType.POWERED_RAIL:   return [[0, -1], [0, 1]];  // N, S (default)
    default:                       return [[0, -1], [0, 1]];  // N, S
  }
}

/**
 * Check if a neighbor rail should update when a new rail is placed/removed nearby.
 * Returns true if the rail needs recomputation (one or both connections are broken).
 * Returns false if both connections still have rails (rail is happy, don't change).
 * This implements Minecraft's behavior where existing rails with 2 valid connections
 * are not disrupted by new adjacent rails.
 */
export function shouldRailUpdate(
  getBlockAt: (x: number, y: number, z: number) => BlockType,
  x: number, y: number, z: number
): boolean {
  const block = getBlockAt(x, y, z);
  if (!isFlat(block)) return false;
  if (block === BlockType.POWERED_RAIL) return false;

  const connections = getRailConnections(block);
  let validCount = 0;
  for (const [dx, dz] of connections) {
    if (isFlat(getBlockAt(x + dx, y, z + dz))) {
      validCount++;
    }
  }
  // Only update if the rail doesn't have both connections satisfied
  return validCount < 2;
}

/**
 * Compute what block type a rail at (x,y,z) should be, considering neighbors.
 * Used at placement time and for neighbor updates.
 * Follows Minecraft's south-east rule: curve priority is SE > SW > NE > NW.
 */
/**
 * Check if there's a rail one level up in a given direction (for slope detection).
 * A slope is valid when: neighbor at same level is solid AND neighbor at Y+1 has a rail.
 */
function hasRailAbove(
  getBlockAt: (x: number, y: number, z: number) => BlockType,
  x: number, y: number, z: number,
  dx: number, dz: number
): boolean {
  const neighborSame = getBlockAt(x + dx, y, z + dz);
  const neighborAbove = getBlockAt(x + dx, y + 1, z + dz);
  // The neighboring block at same level must be solid (the "wall" the rail climbs)
  // and there must be a rail on top of it
  return !isFlat(neighborSame) && neighborSame !== BlockType.AIR && isFlat(neighborAbove);
}

/**
 * Check if there's a rail one level down in a given direction (for slope detection from top).
 */
function hasRailBelow(
  getBlockAt: (x: number, y: number, z: number) => BlockType,
  x: number, y: number, z: number,
  dx: number, dz: number
): boolean {
  const neighborBelow = getBlockAt(x + dx, y - 1, z + dz);
  return isFlat(neighborBelow);
}

export function computeRailBlockType(
  getBlockAt: (x: number, y: number, z: number) => BlockType,
  x: number, y: number, z: number
): BlockType {
  const block = getBlockAt(x, y, z);
  const isPowered = block === BlockType.POWERED_RAIL;

  const hasNorth = isFlat(getBlockAt(x, y, z - 1));
  const hasSouth = isFlat(getBlockAt(x, y, z + 1));
  const hasEast = isFlat(getBlockAt(x + 1, y, z));
  const hasWest = isFlat(getBlockAt(x - 1, y, z));

  if (isPowered) return BlockType.POWERED_RAIL;

  // Slope detection: check for rails one level up/down in each direction
  // A rail slopes UP toward a direction if there's a rail above in that direction
  const slopeUpN = hasRailAbove(getBlockAt, x, y, z, 0, -1);
  const slopeUpS = hasRailAbove(getBlockAt, x, y, z, 0, 1);
  const slopeUpE = hasRailAbove(getBlockAt, x, y, z, 1, 0);
  const slopeUpW = hasRailAbove(getBlockAt, x, y, z, -1, 0);

  // Also check for rails one level down (connecting from top of a slope)
  const slopeDownN = !hasNorth && hasRailBelow(getBlockAt, x, y, z, 0, -1);
  const slopeDownS = !hasSouth && hasRailBelow(getBlockAt, x, y, z, 0, 1);
  const slopeDownE = !hasEast && hasRailBelow(getBlockAt, x, y, z, 1, 0);
  const slopeDownW = !hasWest && hasRailBelow(getBlockAt, x, y, z, -1, 0);

  // If there's a rail above in one direction and a flat/below rail in the opposite, make a slope
  if (slopeUpN && (hasSouth || slopeDownS)) return BlockType.RAIL_SLOPE_N;
  if (slopeUpS && (hasNorth || slopeDownN)) return BlockType.RAIL_SLOPE_S;
  if (slopeUpE && (hasWest || slopeDownW)) return BlockType.RAIL_SLOPE_E;
  if (slopeUpW && (hasEast || slopeDownE)) return BlockType.RAIL_SLOPE_W;

  // Single-direction slope (no opposite rail, but rail above exists)
  if (slopeUpN) return BlockType.RAIL_SLOPE_N;
  if (slopeUpS) return BlockType.RAIL_SLOPE_S;
  if (slopeUpE) return BlockType.RAIL_SLOPE_E;
  if (slopeUpW) return BlockType.RAIL_SLOPE_W;

  const count = (hasNorth ? 1 : 0) + (hasSouth ? 1 : 0) + (hasEast ? 1 : 0) + (hasWest ? 1 : 0);

  // 3 or 4 neighbors (T-junction or 4-way): Minecraft south-east rule
  if (count >= 3) {
    if (hasSouth && hasEast) return BlockType.RAIL_CURVE_SE;
    if (hasSouth && hasWest) return BlockType.RAIL_CURVE_SW;
    if (hasNorth && hasEast) return BlockType.RAIL_CURVE_NE;
    return BlockType.RAIL_CURVE_NW;
  }

  // 2 neighbors
  if (count === 2) {
    if (hasNorth && hasSouth) return BlockType.RAIL;
    if (hasEast && hasWest) return BlockType.RAIL_EW;
    if (hasSouth && hasEast) return BlockType.RAIL_CURVE_SE;
    if (hasSouth && hasWest) return BlockType.RAIL_CURVE_SW;
    if (hasNorth && hasEast) return BlockType.RAIL_CURVE_NE;
    return BlockType.RAIL_CURVE_NW;
  }

  // 1 neighbor
  if (count === 1) {
    if (hasEast || hasWest) return BlockType.RAIL_EW;
    return BlockType.RAIL;
  }

  // 0 neighbors: keep current
  if (block === BlockType.RAIL_EW) return BlockType.RAIL_EW;
  return BlockType.RAIL;
}

export function buildChunkMesh(
  chunk: ChunkData,
  getNeighborBlock?: (wx: number, wy: number, wz: number) => BlockType
): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const sparkles: number[] = [];
  const oreColors: number[] = [];
  const waterFlags: number[] = [];
  const lavaFlags: number[] = [];
  const cableFlags: number[] = [];
  const glassFlags: number[] = [];
  const indices: number[] = [];
  let vertexCount = 0;

  const ox = chunk.cx * CHUNK_SIZE;
  const oz = chunk.cz * CHUNK_SIZE;

  for (let y = 0; y < CHUNK_HEIGHT; y++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const block = chunk.getBlock(x, y, z);
        if (block === BlockType.AIR) continue;

        const wx = ox + x;
        const wz = oz + z;
        const blockDef = getBlock(block);
        const sparkle = blockDef.sparkle ?? 0;
        const isWater = block === BlockType.WATER ? 1.0 : 0.0;
        const isLavaBlock = block === BlockType.LAVA ? 1.0 : 0.0;
        const cableVal = block === BlockType.CABLE_POWERED ? 2.0 : (block === BlockType.CABLE ? 1.0 : 0.0);
        const isGlassBlock = block === BlockType.GLASS || block === BlockType.ICE ? 1.0 : 0.0;
        const oreColor = blockDef.oreColor;

        // Crossed quad rendering for vegetation
        if (isCrossedQuad(block)) {
          const baseColor = blockDef.color;
          const topCol = blockDef.topColor;

          for (const cq of CROSSED_QUAD_FACES) {
            for (let ci = 0; ci < 4; ci++) {
              const corner = cq.corners[ci];
              positions.push(x + corner[0], y + corner[1], z + corner[2]);
              normals.push(cq.normal[0], cq.normal[1], cq.normal[2]);

              const isTop = corner[1] > 0.5;
              const col = (isTop && topCol) ? topCol : baseColor;
              const v = (hash3(wx * 5 + ci, y * 3, wz * 5 + ci) - 0.5) * 0.15;
              colors.push(
                Math.max(0, Math.min(1, col.r + v)),
                Math.max(0, Math.min(1, col.g + v)),
                Math.max(0, Math.min(1, col.b + v * 0.5)),
              );

              const wuv = getWhiteUV();
              const lu = ci % 2 === 0 ? 0 : 1;
              const lv = corner[1] > 0.5 ? 1 : 0;
              uvs.push(wuv.u0 + lu * (wuv.u1 - wuv.u0), wuv.v0 + lv * (wuv.v1 - wuv.v0));
              sparkles.push(0);
              waterFlags.push(0); lavaFlags.push(0); cableFlags.push(0); glassFlags.push(0);
              oreColors.push(1.0, 0.95, 0.8);
            }

            indices.push(
              vertexCount, vertexCount + 1, vertexCount + 2,
              vertexCount, vertexCount + 2, vertexCount + 3
            );
            vertexCount += 4;
          }
          continue;
        }

        // Torch rendering - thin stick with flame top
        if (isTorch(block)) {
          const wuv = getWhiteUV();
          const stickColor = new THREE.Color(0x8b6914);
          const flameColor = new THREE.Color(0xffaa33);
          const flameTopColor = new THREE.Color(0xffee66);

          // Stick dimensions: centered, thin
          const sw = 0.125; // stick width
          const sh = 0.625; // stick height
          const sx0 = 0.5 - sw / 2;
          const sx1 = 0.5 + sw / 2;
          const sz0 = 0.5 - sw / 2;
          const sz1 = 0.5 + sw / 2;
          const sy0 = 0.0;
          const sy1 = sh;

          // Flame dimensions
          const fw = 0.1875;
          const fh = 0.3;
          const fx0 = 0.5 - fw / 2;
          const fx1 = 0.5 + fw / 2;
          const fz0 = 0.5 - fw / 2;
          const fz1 = 0.5 + fw / 2;
          const fy0 = sh;
          const fy1 = sh + fh;

          // Helper to add a box face (isFlame marks flame vertices for shader animation)
          const addTorchFace = (
            corners: [number, number, number][],
            normal: [number, number, number],
            col: THREE.Color,
            isFlame = false
          ) => {
            for (let ci = 0; ci < 4; ci++) {
              const c = corners[ci];
              positions.push(x + c[0], y + c[1], z + c[2]);
              normals.push(normal[0], normal[1], normal[2]);
              colors.push(col.r, col.g, col.b);
              const lu = ci % 2 === 0 ? 0 : 1;
              const lv = ci < 2 ? 0 : 1;
              uvs.push(wuv.u0 + lu * (wuv.u1 - wuv.u0), wuv.v0 + lv * (wuv.v1 - wuv.v0));
              // Use sparkle = -1.0 to mark flame vertices (shader detects this)
              sparkles.push(isFlame ? -1.0 : 0);
              waterFlags.push(0); lavaFlags.push(0); cableFlags.push(0); glassFlags.push(0);
              oreColors.push(1.0, 0.95, 0.8);
            }
            indices.push(
              vertexCount, vertexCount + 1, vertexCount + 2,
              vertexCount, vertexCount + 2, vertexCount + 3
            );
            vertexCount += 4;
          };

          // Stick: 4 side faces + top
          addTorchFace([[sx0,sy0,sz0],[sx1,sy0,sz0],[sx1,sy1,sz0],[sx0,sy1,sz0]], [0,0,-1], stickColor);
          addTorchFace([[sx1,sy0,sz1],[sx0,sy0,sz1],[sx0,sy1,sz1],[sx1,sy1,sz1]], [0,0,1], stickColor);
          addTorchFace([[sx0,sy0,sz1],[sx0,sy0,sz0],[sx0,sy1,sz0],[sx0,sy1,sz1]], [-1,0,0], stickColor);
          addTorchFace([[sx1,sy0,sz0],[sx1,sy0,sz1],[sx1,sy1,sz1],[sx1,sy1,sz0]], [1,0,0], stickColor);
          addTorchFace([[sx0,sy1,sz0],[sx1,sy1,sz0],[sx1,sy1,sz1],[sx0,sy1,sz1]], [0,1,0], stickColor);

          // Flame: 3 crossed quads (star shape) for volumetric glow
          // Quad 1 - diagonal
          addTorchFace([[fx0,fy0,fz0],[fx1,fy0,fz1],[fx1,fy1,fz1],[fx0,fy1,fz0]], [-0.707,0,0.707], flameColor, true);
          addTorchFace([[fx1,fy0,fz1],[fx0,fy0,fz0],[fx0,fy1,fz0],[fx1,fy1,fz1]], [0.707,0,-0.707], flameColor, true);
          // Quad 2 - other diagonal
          addTorchFace([[fx1,fy0,fz0],[fx0,fy0,fz1],[fx0,fy1,fz1],[fx1,fy1,fz0]], [0.707,0,0.707], flameTopColor, true);
          addTorchFace([[fx0,fy0,fz1],[fx1,fy0,fz0],[fx1,fy1,fz0],[fx0,fy1,fz1]], [-0.707,0,-0.707], flameTopColor, true);
          // Quad 3 - front/back for more volume
          addTorchFace([[fx0,fy0,0.5],[fx1,fy0,0.5],[fx1,fy1,0.5],[fx0,fy1,0.5]], [0,0,1], flameColor, true);
          addTorchFace([[fx1,fy0,0.5],[fx0,fy0,0.5],[fx0,fy1,0.5],[fx1,fy1,0.5]], [0,0,-1], flameTopColor, true);

          continue;
        }

        // Flat block rendering (rails) - 3D track with ties, auto-connecting and curving
        if (isFlat(block)) {
          const isPowered = block === BlockType.POWERED_RAIL;
          const tieColor = new THREE.Color(isPowered ? 0x8b4444 : 0x6b4226);
          const metalColor = new THREE.Color(isPowered ? 0xcc3333 : 0x888888);
          const tieHeight = 0.06;
          const railHeight = 0.14;

          const addQuad = (
            corners: [number, number, number][],
            normal: [number, number, number],
            col: THREE.Color
          ) => {
            const railWhite = getWhiteUV();
            for (let ci = 0; ci < 4; ci++) {
              const c = corners[ci];
              positions.push(x + c[0], y + c[1], z + c[2]);
              normals.push(normal[0], normal[1], normal[2]);
              const v = (hash3(wx * 5 + ci, y * 3 + c[1] * 10, wz * 5 + ci) - 0.5) * 0.08;
              colors.push(
                Math.max(0, Math.min(1, col.r + v)),
                Math.max(0, Math.min(1, col.g + v)),
                Math.max(0, Math.min(1, col.b + v)),
              );
              const lu = ci % 2 === 0 ? 0 : 1;
              const lv = ci < 2 ? 0 : 1;
              uvs.push(railWhite.u0 + lu * (railWhite.u1 - railWhite.u0), railWhite.v0 + lv * (railWhite.v1 - railWhite.v0));
              sparkles.push(0);
              waterFlags.push(0); lavaFlags.push(0); cableFlags.push(0); glassFlags.push(0);
              oreColors.push(1.0, 0.95, 0.8);
            }
            indices.push(
              vertexCount, vertexCount + 1, vertexCount + 2,
              vertexCount, vertexCount + 2, vertexCount + 3
            );
            vertexCount += 4;
          };

          // Compute rail shape using shared function
          const getBlockForRail = (bx: number, by: number, bz: number): BlockType => {
            if (bx >= 0 && bx < CHUNK_SIZE && by >= 0 && by < CHUNK_HEIGHT && bz >= 0 && bz < CHUNK_SIZE) {
              return chunk.getBlock(bx, by, bz);
            } else if (getNeighborBlock) {
              return getNeighborBlock(ox + bx, by, oz + bz);
            }
            return BlockType.AIR;
          };
          const shape = computeRailShape(getBlockForRail, x, y, z) ?? 'ns';

          // Slope rail rendering - tilted track ascending in one direction
          if (shape.startsWith('slope_')) {
            const slopeDir = shape.slice(6) as 'n' | 's' | 'e' | 'w';
            // Rail goes from low end (y=tieHeight) to high end (y=1+tieHeight)
            // "slope_n" means ascending toward north (-Z), so z=0 is high, z=1 is low
            // "slope_s" means ascending toward south (+Z), so z=1 is high, z=0 is low
            // "slope_e" means ascending toward east (+X), so x=1 is high, x=0 is low
            // "slope_w" means ascending toward west (-X), so x=0 is high, x=1 is low

            const isNS = slopeDir === 'n' || slopeDir === 's';

            // Height function: returns the Y offset at a position along the slope
            const getH = (t: number): number => {
              // t goes 0..1 along the track axis
              // For 'n' or 'w': t=0 is far end (high), t=1 is near end (low) → ascending = high at 0
              // For 's' or 'e': t=0 is far end (low), t=1 is near end (high) → ascending = high at 1
              if (slopeDir === 'n' || slopeDir === 'w') return (1 - t);
              return t;
            };

            // Cross ties
            const tiePositions = [0.1, 0.3, 0.5, 0.7, 0.9];
            for (const t of tiePositions) {
              const h = getH(t) + tieHeight;
              if (isNS) {
                // Ties run along X, rail goes along Z
                addQuad(
                  [[0.05, h - 0.03, t - 0.06], [0.95, h - 0.03, t - 0.06],
                   [0.95, h + 0.03, t + 0.06], [0.05, h + 0.03, t + 0.06]],
                  [0, 1, 0], tieColor
                );
              } else {
                // Ties run along Z, rail goes along X
                addQuad(
                  [[t - 0.06, h - 0.03, 0.05], [t + 0.06, h + 0.03, 0.05],
                   [t + 0.06, h + 0.03, 0.95], [t - 0.06, h - 0.03, 0.95]],
                  [0, 1, 0], tieColor
                );
              }
            }

            // Two raised metal rails along the slope
            if (isNS) {
              // Rails along Z axis, ascending
              const railXRanges = [
                { x1: 0.18, x2: 0.30 },
                { x1: 0.70, x2: 0.82 },
              ];
              for (const rp of railXRanges) {
                const h0 = getH(0.02) + railHeight;
                const h1 = getH(0.98) + railHeight;
                // Top face of sloped rail
                addQuad(
                  [[rp.x1, h0, 0.02], [rp.x2, h0, 0.02],
                   [rp.x2, h1, 0.98], [rp.x1, h1, 0.98]],
                  [0, 1, 0], metalColor
                );
                // Inner side face
                const innerX = rp.x1 < 0.5 ? rp.x2 : rp.x1;
                const sideNx = rp.x1 < 0.5 ? 1 : -1;
                const th0 = getH(0.02) + tieHeight;
                const th1 = getH(0.98) + tieHeight;
                addQuad(
                  [[innerX, th0, 0.02], [innerX, h0, 0.02],
                   [innerX, h1, 0.98], [innerX, th1, 0.98]],
                  [sideNx, 0, 0],
                  new THREE.Color(metalColor.r * 0.8, metalColor.g * 0.8, metalColor.b * 0.8)
                );
              }
            } else {
              // Rails along X axis, ascending
              const railZRanges = [
                { z1: 0.18, z2: 0.30 },
                { z1: 0.70, z2: 0.82 },
              ];
              for (const rp of railZRanges) {
                const h0 = getH(0.02) + railHeight;
                const h1 = getH(0.98) + railHeight;
                addQuad(
                  [[0.02, h0, rp.z1], [0.02, h0, rp.z2],
                   [0.98, h1, rp.z2], [0.98, h1, rp.z1]],
                  [0, 1, 0], metalColor
                );
                const innerZ = rp.z1 < 0.5 ? rp.z2 : rp.z1;
                const sideNz = rp.z1 < 0.5 ? 1 : -1;
                const th0 = getH(0.02) + tieHeight;
                const th1 = getH(0.98) + tieHeight;
                addQuad(
                  [[0.02, th0, innerZ], [0.02, h0, innerZ],
                   [0.98, h1, innerZ], [0.98, th1, innerZ]],
                  [0, 0, sideNz],
                  new THREE.Color(metalColor.r * 0.8, metalColor.g * 0.8, metalColor.b * 0.8)
                );
              }
            }

            continue;
          }

          if (shape === 'ns' || shape === 'ew') {
            // Straight rail - either NS (along Z) or EW (along X)
            const isEW = shape === 'ew';

            // Cross ties
            const tiePositions = [0.1, 0.3, 0.5, 0.7, 0.9];
            for (const t of tiePositions) {
              if (isEW) {
                // Ties run along Z (perpendicular to X rail)
                addQuad(
                  [[t - 0.06, tieHeight, 0.05], [t + 0.06, tieHeight, 0.05],
                   [t + 0.06, tieHeight, 0.95], [t - 0.06, tieHeight, 0.95]],
                  [0, 1, 0], tieColor
                );
              } else {
                // Ties run along X (perpendicular to Z rail)
                addQuad(
                  [[0.05, tieHeight, t - 0.06], [0.95, tieHeight, t - 0.06],
                   [0.95, tieHeight, t + 0.06], [0.05, tieHeight, t + 0.06]],
                  [0, 1, 0], tieColor
                );
              }
            }

            // Two raised metal rails
            if (isEW) {
              // Rails along X axis
              const railZRanges = [
                { z1: 0.18, z2: 0.30 },
                { z1: 0.70, z2: 0.82 },
              ];
              for (const rp of railZRanges) {
                addQuad(
                  [[0.02, railHeight, rp.z1], [0.98, railHeight, rp.z1],
                   [0.98, railHeight, rp.z2], [0.02, railHeight, rp.z2]],
                  [0, 1, 0], metalColor
                );
                const innerZ = rp.z1 < 0.5 ? rp.z2 : rp.z1;
                const sideNz = rp.z1 < 0.5 ? 1 : -1;
                addQuad(
                  [[0.02, tieHeight, innerZ], [0.02, railHeight, innerZ],
                   [0.98, railHeight, innerZ], [0.98, tieHeight, innerZ]],
                  [0, 0, sideNz],
                  new THREE.Color(metalColor.r * 0.8, metalColor.g * 0.8, metalColor.b * 0.8)
                );
              }
            } else {
              // Rails along Z axis (default)
              const railXRanges = [
                { x1: 0.18, x2: 0.30 },
                { x1: 0.70, x2: 0.82 },
              ];
              for (const rp of railXRanges) {
                addQuad(
                  [[rp.x1, railHeight, 0.02], [rp.x2, railHeight, 0.02],
                   [rp.x2, railHeight, 0.98], [rp.x1, railHeight, 0.98]],
                  [0, 1, 0], metalColor
                );
                const innerX = rp.x1 < 0.5 ? rp.x2 : rp.x1;
                const sideNx = rp.x1 < 0.5 ? 1 : -1;
                addQuad(
                  [[innerX, tieHeight, 0.02], [innerX, railHeight, 0.02],
                   [innerX, railHeight, 0.98], [innerX, tieHeight, 0.98]],
                  [sideNx, 0, 0],
                  new THREE.Color(metalColor.r * 0.8, metalColor.g * 0.8, metalColor.b * 0.8)
                );
              }
            }
          } else {
            // Curved rail - generate arc ties and curved rails
            // Determine curve center and angles based on shape
            // curve_ne: connects -Z (north) and +X (east) -> pivot at (1, 0)
            // curve_nw: connects -Z (north) and -X (west) -> pivot at (0, 0)
            // curve_se: connects +Z (south) and +X (east) -> pivot at (1, 1)
            // curve_sw: connects +Z (south) and -X (west) -> pivot at (0, 1)

            let pivotX: number, pivotZ: number, startAngle: number, angleSpan: number;
            switch (shape) {
              case 'curve_ne': pivotX = 1; pivotZ = 0; startAngle = Math.PI; angleSpan = -Math.PI / 2; break;
              case 'curve_nw': pivotX = 0; pivotZ = 0; startAngle = 0; angleSpan = Math.PI / 2; break;
              case 'curve_se': pivotX = 1; pivotZ = 1; startAngle = Math.PI; angleSpan = Math.PI / 2; break;
              case 'curve_sw': pivotX = 0; pivotZ = 1; startAngle = 0; angleSpan = -Math.PI / 2; break;
            }

            const CURVE_SEGMENTS = 5;

            // Curved ties - extend radially to connect both rails
            for (let s = 0; s < CURVE_SEGMENTS; s++) {
              const t = (s + 0.5) / CURVE_SEGMENTS;
              const angle = startAngle + t * angleSpan;
              const cx = pivotX + Math.cos(angle) * 0.5;
              const cz = pivotZ + Math.sin(angle) * 0.5;
              // Tie extends radially (from inner rail to outer rail)
              const rx = Math.cos(angle) * 0.35;
              const rz = Math.sin(angle) * 0.35;
              // Tie width along tangent direction
              const tw = -Math.sin(angle) * 0.06;
              const th = Math.cos(angle) * 0.06;
              addQuad(
                [[cx - rx + tw, tieHeight, cz - rz + th],
                 [cx + rx + tw, tieHeight, cz + rz + th],
                 [cx + rx - tw, tieHeight, cz + rz - th],
                 [cx - rx - tw, tieHeight, cz - rz - th]],
                [0, 1, 0], tieColor
              );
            }

            // Curved metal rails (inner and outer)
            const railOffsets = [0.24, 0.76]; // inner and outer rail distance from pivot
            const RAIL_SEGMENTS = 8;
            const railWidth = 0.06;
            for (const railR of railOffsets) {
              for (let s = 0; s < RAIL_SEGMENTS; s++) {
                const t0 = s / RAIL_SEGMENTS;
                const t1 = (s + 1) / RAIL_SEGMENTS;
                const a0 = startAngle + t0 * angleSpan;
                const a1 = startAngle + t1 * angleSpan;

                const cx0 = pivotX + Math.cos(a0) * railR;
                const cz0 = pivotZ + Math.sin(a0) * railR;
                const cx1 = pivotX + Math.cos(a1) * railR;
                const cz1 = pivotZ + Math.sin(a1) * railR;

                // Rail width perpendicular to direction
                const nx0 = Math.cos(a0) * railWidth;
                const nz0 = Math.sin(a0) * railWidth;
                const nx1 = Math.cos(a1) * railWidth;
                const nz1 = Math.sin(a1) * railWidth;

                // Top face of curved rail segment
                addQuad(
                  [[cx0 - nx0, railHeight, cz0 - nz0],
                   [cx0 + nx0, railHeight, cz0 + nz0],
                   [cx1 + nx1, railHeight, cz1 + nz1],
                   [cx1 - nx1, railHeight, cz1 - nz1]],
                  [0, 1, 0], metalColor
                );
              }
            }
          }

          continue;
        }

        // Chest rendering (slightly smaller box with darker bottom and lighter lid)
        if (isChest(block)) {
          const baseColor = blockDef.color;
          const lidColor = new THREE.Color(baseColor.r * 1.1, baseColor.g * 1.05, baseColor.b * 0.9);
          const darkColor = new THREE.Color(baseColor.r * 0.7, baseColor.g * 0.65, baseColor.b * 0.55);
          const metalColor = new THREE.Color(0.85, 0.75, 0.2); // gold latch
          // Inset: x 0.0625..0.9375, z 0.0625..0.9375, y 0..0.875
          const x0 = 0.0625, x1 = 0.9375, z0 = 0.0625, z1 = 0.9375;
          const yMid = 0.5625, yTop = 0.875;
          // Bottom half (darker)
          const bottomFaces: { corners: [number,number,number][]; normal: [number,number,number]; color: THREE.Color }[] = [
            { corners: [[x0,0,z1],[x1,0,z1],[x1,0,z0],[x0,0,z0]], normal: [0,-1,0], color: darkColor },
            { corners: [[x0,yMid,z0],[x1,yMid,z0],[x1,yMid,z1],[x0,yMid,z1]], normal: [0,1,0], color: baseColor },
            { corners: [[x1,0,z0],[x1,yMid,z0],[x1,yMid,z1],[x1,0,z1]], normal: [1,0,0], color: darkColor },
            { corners: [[x0,0,z1],[x0,yMid,z1],[x0,yMid,z0],[x0,0,z0]], normal: [-1,0,0], color: darkColor },
            { corners: [[x1,0,z1],[x1,yMid,z1],[x0,yMid,z1],[x0,0,z1]], normal: [0,0,1], color: darkColor },
            { corners: [[x0,0,z0],[x0,yMid,z0],[x1,yMid,z0],[x1,0,z0]], normal: [0,0,-1], color: darkColor },
          ];
          // Lid (lighter)
          const lidFaces: { corners: [number,number,number][]; normal: [number,number,number]; color: THREE.Color }[] = [
            { corners: [[x0,yMid,z0],[x1,yMid,z0],[x1,yMid,z1],[x0,yMid,z1]], normal: [0,-1,0], color: baseColor },
            { corners: [[x0,yTop,z1],[x1,yTop,z1],[x1,yTop,z0],[x0,yTop,z0]], normal: [0,1,0], color: lidColor },
            { corners: [[x1,yMid,z0],[x1,yTop,z0],[x1,yTop,z1],[x1,yMid,z1]], normal: [1,0,0], color: lidColor },
            { corners: [[x0,yMid,z1],[x0,yTop,z1],[x0,yTop,z0],[x0,yMid,z0]], normal: [-1,0,0], color: lidColor },
            { corners: [[x1,yMid,z1],[x1,yTop,z1],[x0,yTop,z1],[x0,yMid,z1]], normal: [0,0,1], color: lidColor },
            { corners: [[x0,yMid,z0],[x0,yTop,z0],[x1,yTop,z0],[x1,yMid,z0]], normal: [0,0,-1], color: lidColor },
          ];
          // Metal latch on front (z+1 side)
          const lx0 = 0.375, lx1 = 0.625, ly0 = 0.4375, ly1 = 0.625, lz = z1 + 0.001;
          const latchFaces: { corners: [number,number,number][]; normal: [number,number,number]; color: THREE.Color }[] = [
            { corners: [[lx1,ly0,lz],[lx1,ly1,lz],[lx0,ly1,lz],[lx0,ly0,lz]], normal: [0,0,1], color: metalColor },
          ];
          for (const face of [...bottomFaces, ...lidFaces, ...latchFaces]) {
            const brightness = face.normal[1] > 0 ? 1.0 : face.normal[1] < 0 ? 0.7 : 0.85;
            const chestFaceName: 'top' | 'side' | 'bottom' = face.normal[1] > 0 ? 'top' : face.normal[1] < 0 ? 'bottom' : 'side';
            const chestAtlas = getAtlasUV(block, chestFaceName);
            for (let ci = 0; ci < 4; ci++) {
              const [cx, cy, cz] = face.corners[ci];
              positions.push(ox + x + cx, y + cy, oz + z + cz);
              normals.push(...face.normal);
              colors.push(brightness, brightness, brightness);
              const lu = ci % 2 === 0 ? 0 : 1;
              const lv = ci < 2 ? 0 : 1;
              uvs.push(chestAtlas.u0 + lu * (chestAtlas.u1 - chestAtlas.u0), chestAtlas.v0 + lv * (chestAtlas.v1 - chestAtlas.v0));
              sparkles.push(0);
              waterFlags.push(0); lavaFlags.push(0); cableFlags.push(0); glassFlags.push(0);
              oreColors.push(0, 0, 0);
            }
            indices.push(vertexCount, vertexCount+1, vertexCount+2, vertexCount, vertexCount+2, vertexCount+3);
            vertexCount += 4;
          }
          continue;
        }

        // Slab rendering (half-height block)
        if (isSlab(block)) {

          // Half-height faces (same structure as FACES but y goes 0 to 0.5)
          const SLAB_FACES: Face[] = [
            { dir: [0, 1, 0], corners: [[0,0.5,1],[1,0.5,1],[1,0.5,0],[0,0.5,0]], faceName: 'top', uvs: [[0,0],[1,0],[1,1],[0,1]] },
            { dir: [0, -1, 0], corners: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]], faceName: 'bottom', uvs: [[0,0],[1,0],[1,1],[0,1]] },
            { dir: [1, 0, 0], corners: [[1,0,0],[1,0.5,0],[1,0.5,1],[1,0,1]], faceName: 'side', uvs: [[0,0],[0,1],[1,1],[1,0]] },
            { dir: [-1, 0, 0], corners: [[0,0,1],[0,0.5,1],[0,0.5,0],[0,0,0]], faceName: 'side', uvs: [[0,0],[0,1],[1,1],[1,0]] },
            { dir: [0, 0, 1], corners: [[1,0,1],[1,0.5,1],[0,0.5,1],[0,0,1]], faceName: 'side', uvs: [[0,0],[0,1],[1,1],[1,0]] },
            { dir: [0, 0, -1], corners: [[0,0,0],[0,0.5,0],[1,0.5,0],[1,0,0]], faceName: 'side', uvs: [[0,0],[0,1],[1,1],[1,0]] },
          ];

          for (const face of SLAB_FACES) {
            const nx = x + face.dir[0];
            const ny = y + face.dir[1];
            const nz = z + face.dir[2];
            let neighborBlock: BlockType;
            if (nx >= 0 && nx < CHUNK_SIZE && ny >= 0 && ny < CHUNK_HEIGHT && nz >= 0 && nz < CHUNK_SIZE) {
              neighborBlock = chunk.getBlock(nx, ny, nz);
            } else if (getNeighborBlock) {
              neighborBlock = getNeighborBlock(ox + nx, ny, oz + nz);
            } else {
              neighborBlock = BlockType.AIR;
            }
            if (!isTransparent(neighborBlock) && neighborBlock !== BlockType.AIR) continue;
            if (neighborBlock === block) continue;

            const faceBrightness = face.faceName === 'top' ? 1.0 : face.faceName === 'side' ? 0.85 : 0.7;
            const slabAtlas = getAtlasUV(block, face.faceName);
            for (let ci = 0; ci < 4; ci++) {
              const corner = face.corners[ci];
              positions.push(x + corner[0], y + corner[1], z + corner[2]);
              normals.push(face.dir[0], face.dir[1], face.dir[2]);
              colors.push(faceBrightness, faceBrightness, faceBrightness);
              const u = slabAtlas.u0 + face.uvs[ci][0] * (slabAtlas.u1 - slabAtlas.u0);
              const v = slabAtlas.v0 + face.uvs[ci][1] * (slabAtlas.v1 - slabAtlas.v0);
              uvs.push(u, v);
              sparkles.push(0);
              waterFlags.push(0); lavaFlags.push(0); cableFlags.push(0); glassFlags.push(0);
              oreColors.push(1.0, 0.95, 0.8);
            }
            indices.push(vertexCount, vertexCount + 1, vertexCount + 2, vertexCount, vertexCount + 2, vertexCount + 3);
            vertexCount += 4;
          }
          continue;
        }

        // Fence rendering (center post + auto-connecting horizontal bars)
        if (isFence(block)) {
          const fenceColor = blockDef.color;
          const darkColor = new THREE.Color(fenceColor.r * 0.8, fenceColor.g * 0.8, fenceColor.b * 0.8);

          const addBoxFaces = (
            x0: number, y0: number, z0: number,
            x1: number, y1: number, z1: number,
            _col: THREE.Color
          ) => {
            // top
            const boxFaces: { corners: [number,number,number][]; normal: [number,number,number]; brightness: number }[] = [
              { corners: [[x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0]], normal: [0,1,0], brightness: 1.0 },
              { corners: [[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1]], normal: [0,-1,0], brightness: 0.7 },
              { corners: [[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[x1,y0,z1]], normal: [1,0,0], brightness: 0.85 },
              { corners: [[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],[x0,y0,z0]], normal: [-1,0,0], brightness: 0.85 },
              { corners: [[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],[x0,y0,z1]], normal: [0,0,1], brightness: 0.85 },
              { corners: [[x0,y0,z0],[x0,y1,z0],[x1,y1,z0],[x1,y0,z0]], normal: [0,0,-1], brightness: 0.85 },
            ];
            for (const bf of boxFaces) {
              const fName: 'top' | 'side' | 'bottom' = bf.normal[1] > 0 ? 'top' : bf.normal[1] < 0 ? 'bottom' : 'side';
              const fAtlas = getAtlasUV(block, fName);
              for (let ci = 0; ci < 4; ci++) {
                const c = bf.corners[ci];
                positions.push(x + c[0], y + c[1], z + c[2]);
                normals.push(bf.normal[0], bf.normal[1], bf.normal[2]);
                colors.push(bf.brightness, bf.brightness, bf.brightness);
                const lu = ci % 2 === 0 ? 0 : 1;
                const lv = ci < 2 ? 0 : 1;
                uvs.push(fAtlas.u0 + lu * (fAtlas.u1 - fAtlas.u0), fAtlas.v0 + lv * (fAtlas.v1 - fAtlas.v0));
                sparkles.push(0);
                waterFlags.push(0); lavaFlags.push(0); cableFlags.push(0); glassFlags.push(0);
                oreColors.push(1.0, 0.95, 0.8);
              }
              indices.push(vertexCount, vertexCount + 1, vertexCount + 2, vertexCount, vertexCount + 2, vertexCount + 3);
              vertexCount += 4;
            }
          };

          // Center post (0.375-0.625 = 0.25 wide)
          addBoxFaces(0.375, 0, 0.375, 0.625, 1, 0.625, fenceColor);

          // Check neighbors for connections (fence or solid block)
          const canConnect = (lx: number, ly: number, lz: number): boolean => {
            let nb: BlockType;
            if (lx >= 0 && lx < CHUNK_SIZE && ly >= 0 && ly < CHUNK_HEIGHT && lz >= 0 && lz < CHUNK_SIZE) {
              nb = chunk.getBlock(lx, ly, lz);
            } else if (getNeighborBlock) {
              nb = getNeighborBlock(ox + lx, ly, oz + lz);
            } else {
              return false;
            }
            return isFence(nb) || (!isTransparent(nb) && nb !== BlockType.AIR);
          };

          // Connecting bars (two horizontal bars at different heights)
          const barHeights = [[0.25, 0.40], [0.65, 0.80]]; // [bottom, top] of each bar
          if (canConnect(x + 1, y, z)) { // east
            for (const [by0, by1] of barHeights) {
              addBoxFaces(0.625, by0, 0.4375, 1.0, by1, 0.5625, darkColor);
            }
          }
          if (canConnect(x - 1, y, z)) { // west
            for (const [by0, by1] of barHeights) {
              addBoxFaces(0.0, by0, 0.4375, 0.375, by1, 0.5625, darkColor);
            }
          }
          if (canConnect(x, y, z + 1)) { // south
            for (const [by0, by1] of barHeights) {
              addBoxFaces(0.4375, by0, 0.625, 0.5625, by1, 1.0, darkColor);
            }
          }
          if (canConnect(x, y, z - 1)) { // north
            for (const [by0, by1] of barHeights) {
              addBoxFaces(0.4375, by0, 0.0, 0.5625, by1, 0.375, darkColor);
            }
          }
          continue;
        }

        // Stairs rendering (step geometry based on direction)
        if (isStairs(block)) {
          const stairColor = blockDef.color;
          const darkColor = new THREE.Color(stairColor.r * 0.85, stairColor.g * 0.85, stairColor.b * 0.85);
          const dir = blockDef.stairDir!;

          const addBoxFaces = (
            x0: number, y0: number, z0: number,
            x1: number, y1: number, z1: number,
            _col: THREE.Color
          ) => {
            const boxFaces: { corners: [number,number,number][]; normal: [number,number,number]; brightness: number }[] = [
              { corners: [[x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0]], normal: [0,1,0], brightness: 1.0 },
              { corners: [[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1]], normal: [0,-1,0], brightness: 0.7 },
              { corners: [[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[x1,y0,z1]], normal: [1,0,0], brightness: 0.85 },
              { corners: [[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],[x0,y0,z0]], normal: [-1,0,0], brightness: 0.85 },
              { corners: [[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],[x0,y0,z1]], normal: [0,0,1], brightness: 0.85 },
              { corners: [[x0,y0,z0],[x0,y1,z0],[x1,y1,z0],[x1,y0,z0]], normal: [0,0,-1], brightness: 0.85 },
            ];
            for (const bf of boxFaces) {
              const fName: 'top' | 'side' | 'bottom' = bf.normal[1] > 0 ? 'top' : bf.normal[1] < 0 ? 'bottom' : 'side';
              const fAtlas = getAtlasUV(block, fName);
              for (let ci = 0; ci < 4; ci++) {
                const c = bf.corners[ci];
                positions.push(x + c[0], y + c[1], z + c[2]);
                normals.push(bf.normal[0], bf.normal[1], bf.normal[2]);
                colors.push(bf.brightness, bf.brightness, bf.brightness);
                const lu = ci % 2 === 0 ? 0 : 1;
                const lv = ci < 2 ? 0 : 1;
                uvs.push(fAtlas.u0 + lu * (fAtlas.u1 - fAtlas.u0), fAtlas.v0 + lv * (fAtlas.v1 - fAtlas.v0));
                sparkles.push(0);
                waterFlags.push(0); lavaFlags.push(0); cableFlags.push(0); glassFlags.push(0);
                oreColors.push(1.0, 0.95, 0.8);
              }
              indices.push(vertexCount, vertexCount + 1, vertexCount + 2, vertexCount, vertexCount + 2, vertexCount + 3);
              vertexCount += 4;
            }
          };

          // Bottom half (full width, half height)
          addBoxFaces(0, 0, 0, 1, 0.5, 1, stairColor);

          // Upper step (half width in the direction the stair rises)
          switch (dir) {
            case 'n': addBoxFaces(0, 0.5, 0, 1, 1, 0.5, darkColor); break;   // step rises toward -Z
            case 's': addBoxFaces(0, 0.5, 0.5, 1, 1, 1, darkColor); break;   // step rises toward +Z
            case 'e': addBoxFaces(0.5, 0.5, 0, 1, 1, 1, darkColor); break;   // step rises toward +X
            case 'w': addBoxFaces(0, 0.5, 0, 0.5, 1, 1, darkColor); break;   // step rises toward -X
          }
          continue;
        }

        // Door rendering (thin vertical panel)
        if (isDoor(block)) {
          const doorColor = blockDef.color;
          const isOpen = blockDef.doorOpen === true;

          const addBoxFaces = (
            x0: number, y0: number, z0: number,
            x1: number, y1: number, z1: number,
            _col: THREE.Color
          ) => {
            const boxFaces: { corners: [number,number,number][]; normal: [number,number,number]; brightness: number }[] = [
              { corners: [[x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0]], normal: [0,1,0], brightness: 1.0 },
              { corners: [[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1]], normal: [0,-1,0], brightness: 0.7 },
              { corners: [[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[x1,y0,z1]], normal: [1,0,0], brightness: 0.85 },
              { corners: [[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],[x0,y0,z0]], normal: [-1,0,0], brightness: 0.85 },
              { corners: [[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],[x0,y0,z1]], normal: [0,0,1], brightness: 0.9 },
              { corners: [[x0,y0,z0],[x0,y1,z0],[x1,y1,z0],[x1,y0,z0]], normal: [0,0,-1], brightness: 0.9 },
            ];
            for (const bf of boxFaces) {
              const fName: 'top' | 'side' | 'bottom' = bf.normal[1] > 0 ? 'top' : bf.normal[1] < 0 ? 'bottom' : 'side';
              const fAtlas = getAtlasUV(block, fName);
              for (let ci = 0; ci < 4; ci++) {
                const c = bf.corners[ci];
                positions.push(x + c[0], y + c[1], z + c[2]);
                normals.push(bf.normal[0], bf.normal[1], bf.normal[2]);
                colors.push(bf.brightness, bf.brightness, bf.brightness);
                const lu = ci % 2 === 0 ? 0 : 1;
                const lv = ci < 2 ? 0 : 1;
                uvs.push(fAtlas.u0 + lu * (fAtlas.u1 - fAtlas.u0), fAtlas.v0 + lv * (fAtlas.v1 - fAtlas.v0));
                sparkles.push(0);
                waterFlags.push(0); lavaFlags.push(0); cableFlags.push(0); glassFlags.push(0);
                oreColors.push(1.0, 0.95, 0.8);
              }
              indices.push(vertexCount, vertexCount + 1, vertexCount + 2, vertexCount, vertexCount + 2, vertexCount + 3);
              vertexCount += 4;
            }
          };

          if (isOpen) {
            // Open door: thin along X axis, full Z, attached to west edge
            addBoxFaces(0, 0, 0, 0.15, 1, 1, doorColor);
          } else {
            // Closed door: thin along Z axis, full X
            addBoxFaces(0, 0, 0.425, 1, 1, 0.575, doorColor);
          }
          continue;
        }

        // Lever rendering
        if (isLever(block)) {
          const leverDef = getBlock(block);
          const isOn = leverDef.leverOn === true;
          const baseColor = new THREE.Color(0x555555);
          const stickColor = leverDef.color;
          const whiteUV = getWhiteUV();

          // Stone base plate
          const bx0 = 0.3, bx1 = 0.7, bz0 = 0.3, bz1 = 0.7;
          const by0 = 0, by1 = 0.15;
          const baseFaces: { c: [number,number,number][]; n: [number,number,number]; b: number }[] = [
            { c: [[bx0,by1,bz1],[bx1,by1,bz1],[bx1,by1,bz0],[bx0,by1,bz0]], n: [0,1,0], b: 1.0 },
            { c: [[bx0,by0,bz0],[bx1,by0,bz0],[bx1,by0,bz1],[bx0,by0,bz1]], n: [0,-1,0], b: 0.7 },
            { c: [[bx1,by0,bz0],[bx1,by1,bz0],[bx1,by1,bz1],[bx1,by0,bz1]], n: [1,0,0], b: 0.85 },
            { c: [[bx0,by0,bz1],[bx0,by1,bz1],[bx0,by1,bz0],[bx0,by0,bz0]], n: [-1,0,0], b: 0.85 },
            { c: [[bx1,by0,bz1],[bx1,by1,bz1],[bx0,by1,bz1],[bx0,by0,bz1]], n: [0,0,1], b: 0.9 },
            { c: [[bx0,by0,bz0],[bx0,by1,bz0],[bx1,by1,bz0],[bx1,by0,bz0]], n: [0,0,-1], b: 0.9 },
          ];
          for (const f of baseFaces) {
            for (let ci = 0; ci < 4; ci++) {
              positions.push(x + f.c[ci][0], y + f.c[ci][1], z + f.c[ci][2]);
              normals.push(f.n[0], f.n[1], f.n[2]);
              colors.push(baseColor.r * f.b, baseColor.g * f.b, baseColor.b * f.b);
              uvs.push(whiteUV.u0, whiteUV.v0);
              sparkles.push(0); waterFlags.push(0); lavaFlags.push(0); cableFlags.push(0); glassFlags.push(0); oreColors.push(1, 0.95, 0.8);
            }
            indices.push(vertexCount, vertexCount+1, vertexCount+2, vertexCount, vertexCount+2, vertexCount+3);
            vertexCount += 4;
          }

          // Stick (angled differently for ON/OFF)
          const sw = 0.08;
          const sh = 0.45;
          const sx = 0.5 - sw/2, sx1l = 0.5 + sw/2;
          const sz = 0.5 - sw/2, sz1l = 0.5 + sw/2;
          // ON: stick tilted up, OFF: stick tilted down
          const tipY = isOn ? 0.15 + sh : 0.15 + sh * 0.6;
          const tipOffset = isOn ? 0.0 : 0.15;
          const stickFaces: { c: [number,number,number][]; n: [number,number,number]; b: number }[] = [
            { c: [[sx+tipOffset,tipY,sz],[sx1l+tipOffset,tipY,sz],[sx1l,0.15,sz1l],[sx,0.15,sz1l]], n: [0,0,-1], b: 0.85 },
            { c: [[sx,0.15,sz1l],[sx1l,0.15,sz1l],[sx1l+tipOffset,tipY,sz1l],[sx+tipOffset,tipY,sz1l]], n: [0,0,1], b: 0.85 },
            { c: [[sx1l,0.15,sz1l],[sx1l,0.15,sz],[sx1l+tipOffset,tipY,sz],[sx1l+tipOffset,tipY,sz1l]], n: [1,0,0], b: 0.9 },
            { c: [[sx+tipOffset,tipY,sz1l],[sx+tipOffset,tipY,sz],[sx,0.15,sz],[sx,0.15,sz1l]], n: [-1,0,0], b: 0.9 },
          ];
          for (const f of stickFaces) {
            for (let ci = 0; ci < 4; ci++) {
              positions.push(x + f.c[ci][0], y + f.c[ci][1], z + f.c[ci][2]);
              normals.push(f.n[0], f.n[1], f.n[2]);
              colors.push(stickColor.r * f.b, stickColor.g * f.b, stickColor.b * f.b);
              uvs.push(whiteUV.u0, whiteUV.v0);
              sparkles.push(0); waterFlags.push(0); lavaFlags.push(0); cableFlags.push(0); glassFlags.push(0); oreColors.push(1, 0.95, 0.8);
            }
            indices.push(vertexCount, vertexCount+1, vertexCount+2, vertexCount, vertexCount+2, vertexCount+3);
            vertexCount += 4;
          }
          continue;
        }

        // Button rendering
        if (isButton(block)) {
          const btnColor = blockDef.color;
          const whiteUV = getWhiteUV();
          // Small stone button on surface
          const bx0 = 0.35, bx1 = 0.65;
          const by0 = 0.25, by1 = 0.5;
          const bz0 = 0.4, bz1 = 0.6;
          const btnFaces: { c: [number,number,number][]; n: [number,number,number]; b: number }[] = [
            { c: [[bx0,by1,bz1],[bx1,by1,bz1],[bx1,by1,bz0],[bx0,by1,bz0]], n: [0,1,0], b: 1.0 },
            { c: [[bx0,by0,bz0],[bx1,by0,bz0],[bx1,by0,bz1],[bx0,by0,bz1]], n: [0,-1,0], b: 0.7 },
            { c: [[bx1,by0,bz0],[bx1,by1,bz0],[bx1,by1,bz1],[bx1,by0,bz1]], n: [1,0,0], b: 0.85 },
            { c: [[bx0,by0,bz1],[bx0,by1,bz1],[bx0,by1,bz0],[bx0,by0,bz0]], n: [-1,0,0], b: 0.85 },
            { c: [[bx1,by0,bz1],[bx1,by1,bz1],[bx0,by1,bz1],[bx0,by0,bz1]], n: [0,0,1], b: 0.9 },
            { c: [[bx0,by0,bz0],[bx0,by1,bz0],[bx1,by1,bz0],[bx1,by0,bz0]], n: [0,0,-1], b: 0.9 },
          ];
          for (const f of btnFaces) {
            for (let ci = 0; ci < 4; ci++) {
              positions.push(x + f.c[ci][0], y + f.c[ci][1], z + f.c[ci][2]);
              normals.push(f.n[0], f.n[1], f.n[2]);
              colors.push(btnColor.r * f.b, btnColor.g * f.b, btnColor.b * f.b);
              uvs.push(whiteUV.u0, whiteUV.v0);
              sparkles.push(0); waterFlags.push(0); lavaFlags.push(0); cableFlags.push(0); glassFlags.push(0); oreColors.push(1, 0.95, 0.8);
            }
            indices.push(vertexCount, vertexCount+1, vertexCount+2, vertexCount, vertexCount+2, vertexCount+3);
            vertexCount += 4;
          }
          continue;
        }

        // Cable rendering - redstone-style dashed wire with center dot
        if (isCable(block)) {
          const cDef = getBlock(block);
          const cCol = cDef.color;
          const powered = cDef.cablePowered === true;
          const whiteUV = getWhiteUV();
          const brightness = powered ? 1.2 : 0.7;

          // Check neighbors for cable connections (4 horizontal directions)
          const dirs4: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
          const connected: boolean[] = [];
          for (const [dx, dz] of dirs4) {
            const cnx = x + dx;
            const cnz = z + dz;
            let nBlock: BlockType;
            if (cnx >= 0 && cnx < CHUNK_SIZE && cnz >= 0 && cnz < CHUNK_SIZE) {
              nBlock = chunk.getBlock(cnx, y, cnz);
            } else if (getNeighborBlock) {
              nBlock = getNeighborBlock(ox + cnx, y, oz + cnz);
            } else {
              nBlock = BlockType.AIR;
            }
            const nDef = getBlock(nBlock);
            connected.push(nDef.isCable === true || nDef.isLever === true || nDef.isRepeater === true || nDef.isComparator === true || nBlock === BlockType.POWERED_RAIL);
          }

          const cy0 = 0.005, cy1 = 0.04; // very flat, sits on floor
          const hw = 0.06; // half-width of wire (thinner)

          // Helper: push a flat box segment
          const pushCableSeg = (sx0: number, sz0: number, sx1: number, sz1: number, b: number) => {
            // Top face only (flat on floor, no need for side faces)
            const corners: [number, number, number][] = [
              [sx0, cy1, sz1], [sx1, cy1, sz1], [sx1, cy1, sz0], [sx0, cy1, sz0],
            ];
            for (let ci = 0; ci < 4; ci++) {
              positions.push(x + corners[ci][0], y + corners[ci][1], z + corners[ci][2]);
              normals.push(0, 1, 0);
              colors.push(cCol.r * b * brightness, cCol.g * b * brightness, cCol.b * b * brightness);
              uvs.push(whiteUV.u0, whiteUV.v0);
              sparkles.push(0); waterFlags.push(0); lavaFlags.push(0); cableFlags.push(cableVal); glassFlags.push(0); oreColors.push(1, 0.95, 0.8);
            }
            indices.push(vertexCount, vertexCount+1, vertexCount+2, vertexCount, vertexCount+2, vertexCount+3);
            vertexCount += 4;
            // Bottom face (visible from below if cable is on glass etc.)
            const cornersB: [number, number, number][] = [
              [sx0, cy0, sz0], [sx1, cy0, sz0], [sx1, cy0, sz1], [sx0, cy0, sz1],
            ];
            for (let ci = 0; ci < 4; ci++) {
              positions.push(x + cornersB[ci][0], y + cornersB[ci][1], z + cornersB[ci][2]);
              normals.push(0, -1, 0);
              colors.push(cCol.r * b * brightness * 0.7, cCol.g * b * brightness * 0.7, cCol.b * b * brightness * 0.7);
              uvs.push(whiteUV.u0, whiteUV.v0);
              sparkles.push(0); waterFlags.push(0); lavaFlags.push(0); cableFlags.push(cableVal); glassFlags.push(0); oreColors.push(1, 0.95, 0.8);
            }
            indices.push(vertexCount, vertexCount+1, vertexCount+2, vertexCount, vertexCount+2, vertexCount+3);
            vertexCount += 4;
          };

          // Center dot (larger, like redstone dust center)
          const dotR = 0.1;
          pushCableSeg(0.5 - dotR, 0.5 - dotR, 0.5 + dotR, 0.5 + dotR, 1.0);

          // Dashed segments toward connected neighbors
          // Each arm: 2 dashes with a gap between
          const dashLen = 0.12;
          const gapLen = 0.06;

          // +X direction: dashes from center toward x=1
          if (connected[0]) {
            const start = 0.5 + dotR;
            pushCableSeg(start, 0.5 - hw, start + dashLen, 0.5 + hw, 0.9);
            pushCableSeg(start + dashLen + gapLen, 0.5 - hw, 1.0, 0.5 + hw, 0.85);
          }
          // -X direction: dashes from center toward x=0
          if (connected[1]) {
            const end = 0.5 - dotR;
            pushCableSeg(end - dashLen, 0.5 - hw, end, 0.5 + hw, 0.9);
            pushCableSeg(0.0, 0.5 - hw, end - dashLen - gapLen, 0.5 + hw, 0.85);
          }
          // +Z direction: dashes from center toward z=1
          if (connected[2]) {
            const start = 0.5 + dotR;
            pushCableSeg(0.5 - hw, start, 0.5 + hw, start + dashLen, 0.9);
            pushCableSeg(0.5 - hw, start + dashLen + gapLen, 0.5 + hw, 1.0, 0.85);
          }
          // -Z direction: dashes from center toward z=0
          if (connected[3]) {
            const end = 0.5 - dotR;
            pushCableSeg(0.5 - hw, end - dashLen, 0.5 + hw, end, 0.9);
            pushCableSeg(0.5 - hw, 0.0, 0.5 + hw, end - dashLen - gapLen, 0.85);
          }

          continue;
        }

        // Piston rendering (body block with wooden/stone face plate)
        if (isPiston(block)) {
          const bodyColor = blockDef.color;
          const isSticky = blockDef.isStickyPiston === true;
          const plateColor = isSticky ? new THREE.Color(0x5a8a2d) : new THREE.Color(0x707070); // green slime or stone face
          const rodColor = new THREE.Color(0x5a3a1a); // dark wood rod
          const extended = blockDef.pistonExtended === true;

          // Body: slightly inset top if extended (missing top part)
          const bodyTop = extended ? 0.75 : 1.0;
          const bodyFaces: { corners: [number,number,number][]; normal: [number,number,number]; brightness: number; col: THREE.Color }[] = [
            { corners: [[0,bodyTop,1],[1,bodyTop,1],[1,bodyTop,0],[0,bodyTop,0]], normal: [0,1,0], brightness: 1.0, col: extended ? rodColor : plateColor },
            { corners: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]], normal: [0,-1,0], brightness: 0.7, col: bodyColor },
            { corners: [[1,0,0],[1,bodyTop,0],[1,bodyTop,1],[1,0,1]], normal: [1,0,0], brightness: 0.85, col: bodyColor },
            { corners: [[0,0,1],[0,bodyTop,1],[0,bodyTop,0],[0,0,0]], normal: [-1,0,0], brightness: 0.85, col: bodyColor },
            { corners: [[1,0,1],[1,bodyTop,1],[0,bodyTop,1],[0,0,1]], normal: [0,0,1], brightness: 0.85, col: bodyColor },
            { corners: [[0,0,0],[0,bodyTop,0],[1,bodyTop,0],[1,0,0]], normal: [0,0,-1], brightness: 0.85, col: bodyColor },
          ];

          // If extended, add the rod sticking up
          if (extended) {
            const rodR = 0.125;
            const rFaces: { corners: [number,number,number][]; normal: [number,number,number]; brightness: number; col: THREE.Color }[] = [
              { corners: [[0.5-rodR,bodyTop,0.5+rodR],[0.5+rodR,bodyTop,0.5+rodR],[0.5+rodR,bodyTop,0.5-rodR],[0.5-rodR,bodyTop,0.5-rodR]], normal: [0,-1,0], brightness: 0.7, col: rodColor },
              { corners: [[0.5+rodR,bodyTop,0.5-rodR],[0.5+rodR,1.0,0.5-rodR],[0.5+rodR,1.0,0.5+rodR],[0.5+rodR,bodyTop,0.5+rodR]], normal: [1,0,0], brightness: 0.85, col: rodColor },
              { corners: [[0.5-rodR,bodyTop,0.5+rodR],[0.5-rodR,1.0,0.5+rodR],[0.5-rodR,1.0,0.5-rodR],[0.5-rodR,bodyTop,0.5-rodR]], normal: [-1,0,0], brightness: 0.85, col: rodColor },
              { corners: [[0.5+rodR,bodyTop,0.5+rodR],[0.5+rodR,1.0,0.5+rodR],[0.5-rodR,1.0,0.5+rodR],[0.5-rodR,bodyTop,0.5+rodR]], normal: [0,0,1], brightness: 0.85, col: rodColor },
              { corners: [[0.5-rodR,bodyTop,0.5-rodR],[0.5-rodR,1.0,0.5-rodR],[0.5+rodR,1.0,0.5-rodR],[0.5+rodR,bodyTop,0.5-rodR]], normal: [0,0,-1], brightness: 0.85, col: rodColor },
            ];
            bodyFaces.push(...rFaces);
          }

          const pistonAtlas = getWhiteUV();
          for (const face of bodyFaces) {
            for (let ci = 0; ci < 4; ci++) {
              const [cx, cy, cz] = face.corners[ci];
              positions.push(ox + x + cx, y + cy, oz + z + cz);
              normals.push(...face.normal);
              colors.push(face.col.r * face.brightness, face.col.g * face.brightness, face.col.b * face.brightness);
              uvs.push(pistonAtlas.u0, pistonAtlas.v0);
              sparkles.push(0);
              waterFlags.push(0); lavaFlags.push(0); cableFlags.push(0); glassFlags.push(0);
              oreColors.push(0, 0, 0);
            }
            indices.push(vertexCount, vertexCount+1, vertexCount+2, vertexCount, vertexCount+2, vertexCount+3);
            vertexCount += 4;
          }
          continue;
        }

        // Piston Head rendering (flat plate on top of rod)
        if (isPistonHead(block)) {
          const plateColor = blockDef.isStickyPiston ? new THREE.Color(0x5a8a2d) : new THREE.Color(0x707070);
          const rodColor = new THREE.Color(0x5a3a1a);
          const rodR = 0.125;

          const headFaces: { corners: [number,number,number][]; normal: [number,number,number]; brightness: number; col: THREE.Color }[] = [
            // Plate (top half-slab)
            { corners: [[0,0.75,1],[1,0.75,1],[1,0.75,0],[0,0.75,0]], normal: [0,-1,0], brightness: 0.7, col: plateColor },
            { corners: [[0,1,0],[1,1,0],[1,1,1],[0,1,1]], normal: [0,1,0], brightness: 1.0, col: plateColor },
            { corners: [[1,0.75,0],[1,1,0],[1,1,1],[1,0.75,1]], normal: [1,0,0], brightness: 0.85, col: plateColor },
            { corners: [[0,0.75,1],[0,1,1],[0,1,0],[0,0.75,0]], normal: [-1,0,0], brightness: 0.85, col: plateColor },
            { corners: [[1,0.75,1],[1,1,1],[0,1,1],[0,0.75,1]], normal: [0,0,1], brightness: 0.85, col: plateColor },
            { corners: [[0,0.75,0],[0,1,0],[1,1,0],[1,0.75,0]], normal: [0,0,-1], brightness: 0.85, col: plateColor },
            // Rod going down
            { corners: [[0.5+rodR,0,0.5-rodR],[0.5+rodR,0.75,0.5-rodR],[0.5+rodR,0.75,0.5+rodR],[0.5+rodR,0,0.5+rodR]], normal: [1,0,0], brightness: 0.85, col: rodColor },
            { corners: [[0.5-rodR,0,0.5+rodR],[0.5-rodR,0.75,0.5+rodR],[0.5-rodR,0.75,0.5-rodR],[0.5-rodR,0,0.5-rodR]], normal: [-1,0,0], brightness: 0.85, col: rodColor },
            { corners: [[0.5+rodR,0,0.5+rodR],[0.5+rodR,0.75,0.5+rodR],[0.5-rodR,0.75,0.5+rodR],[0.5-rodR,0,0.5+rodR]], normal: [0,0,1], brightness: 0.85, col: rodColor },
            { corners: [[0.5-rodR,0,0.5-rodR],[0.5-rodR,0.75,0.5-rodR],[0.5+rodR,0.75,0.5-rodR],[0.5+rodR,0,0.5-rodR]], normal: [0,0,-1], brightness: 0.85, col: rodColor },
          ];

          const phAtlas = getWhiteUV();
          for (const face of headFaces) {
            for (let ci = 0; ci < 4; ci++) {
              const [cx, cy, cz] = face.corners[ci];
              positions.push(ox + x + cx, y + cy, oz + z + cz);
              normals.push(...face.normal);
              colors.push(face.col.r * face.brightness, face.col.g * face.brightness, face.col.b * face.brightness);
              uvs.push(phAtlas.u0, phAtlas.v0);
              sparkles.push(0);
              waterFlags.push(0); lavaFlags.push(0); cableFlags.push(0); glassFlags.push(0);
              oreColors.push(0, 0, 0);
            }
            indices.push(vertexCount, vertexCount+1, vertexCount+2, vertexCount, vertexCount+2, vertexCount+3);
            vertexCount += 4;
          }
          continue;
        }

        // Sign rendering (thin flat panel on a post)
        if (isSign(block)) {
          const woodColor = blockDef.color;
          const postColor = new THREE.Color(woodColor.r * 0.7, woodColor.g * 0.7, woodColor.b * 0.7);
          // Post: thin stick from ground to sign panel
          const pw = 0.0625;
          // Sign panel: flat board
          const panelY0 = 0.45, panelY1 = 0.95;
          const panelZ = 0.45, panelZ1 = 0.55;

          const signFaces: { corners: [number,number,number][]; normal: [number,number,number]; brightness: number; col: THREE.Color }[] = [
            // Post
            { corners: [[0.5-pw,0,0.5+pw],[0.5+pw,0,0.5+pw],[0.5+pw,0,0.5-pw],[0.5-pw,0,0.5-pw]], normal: [0,-1,0], brightness: 0.7, col: postColor },
            { corners: [[0.5+pw,0,0.5-pw],[0.5+pw,panelY0,0.5-pw],[0.5+pw,panelY0,0.5+pw],[0.5+pw,0,0.5+pw]], normal: [1,0,0], brightness: 0.85, col: postColor },
            { corners: [[0.5-pw,0,0.5+pw],[0.5-pw,panelY0,0.5+pw],[0.5-pw,panelY0,0.5-pw],[0.5-pw,0,0.5-pw]], normal: [-1,0,0], brightness: 0.85, col: postColor },
            { corners: [[0.5+pw,0,0.5+pw],[0.5+pw,panelY0,0.5+pw],[0.5-pw,panelY0,0.5+pw],[0.5-pw,0,0.5+pw]], normal: [0,0,1], brightness: 0.85, col: postColor },
            { corners: [[0.5-pw,0,0.5-pw],[0.5-pw,panelY0,0.5-pw],[0.5+pw,panelY0,0.5-pw],[0.5+pw,0,0.5-pw]], normal: [0,0,-1], brightness: 0.85, col: postColor },
            // Panel - front and back
            { corners: [[0.1,panelY0,panelZ1],[0.9,panelY0,panelZ1],[0.9,panelY1,panelZ1],[0.1,panelY1,panelZ1]], normal: [0,0,1], brightness: 0.9, col: woodColor },
            { corners: [[0.9,panelY0,panelZ],[0.1,panelY0,panelZ],[0.1,panelY1,panelZ],[0.9,panelY1,panelZ]], normal: [0,0,-1], brightness: 0.9, col: woodColor },
            // Panel top
            { corners: [[0.1,panelY1,panelZ],[0.9,panelY1,panelZ],[0.9,panelY1,panelZ1],[0.1,panelY1,panelZ1]], normal: [0,1,0], brightness: 1.0, col: woodColor },
            // Panel bottom
            { corners: [[0.1,panelY0,panelZ1],[0.9,panelY0,panelZ1],[0.9,panelY0,panelZ],[0.1,panelY0,panelZ]], normal: [0,-1,0], brightness: 0.7, col: woodColor },
            // Panel sides
            { corners: [[0.9,panelY0,panelZ],[0.9,panelY1,panelZ],[0.9,panelY1,panelZ1],[0.9,panelY0,panelZ1]], normal: [1,0,0], brightness: 0.85, col: woodColor },
            { corners: [[0.1,panelY0,panelZ1],[0.1,panelY1,panelZ1],[0.1,panelY1,panelZ],[0.1,panelY0,panelZ]], normal: [-1,0,0], brightness: 0.85, col: woodColor },
          ];

          const signAtlas = getWhiteUV();
          for (const face of signFaces) {
            for (let ci = 0; ci < 4; ci++) {
              const [cx, cy, cz] = face.corners[ci];
              positions.push(ox + x + cx, y + cy, oz + z + cz);
              normals.push(...face.normal);
              colors.push(face.col.r * face.brightness, face.col.g * face.brightness, face.col.b * face.brightness);
              uvs.push(signAtlas.u0, signAtlas.v0);
              sparkles.push(0);
              waterFlags.push(0); lavaFlags.push(0); cableFlags.push(0); glassFlags.push(0);
              oreColors.push(0, 0, 0);
            }
            indices.push(vertexCount, vertexCount+1, vertexCount+2, vertexCount, vertexCount+2, vertexCount+3);
            vertexCount += 4;
          }
          continue;
        }

        // Pressure plate rendering (flat plate on ground)
        if (isPressurePlate(block)) {
          const plateColor = blockDef.color;
          const isOn = blockDef.pressurePlateOn === true;
          const plateH = isOn ? 0.03 : 0.06;
          const whiteUV = getWhiteUV();
          const px0 = 0.1, px1 = 0.9, pz0 = 0.1, pz1 = 0.9;
          const plateFaces: { c: [number,number,number][]; n: [number,number,number]; b: number }[] = [
            { c: [[px0,plateH,pz1],[px1,plateH,pz1],[px1,plateH,pz0],[px0,plateH,pz0]], n: [0,1,0], b: 1.0 },
            { c: [[px0,0,pz0],[px1,0,pz0],[px1,0,pz1],[px0,0,pz1]], n: [0,-1,0], b: 0.7 },
            { c: [[px1,0,pz0],[px1,plateH,pz0],[px1,plateH,pz1],[px1,0,pz1]], n: [1,0,0], b: 0.85 },
            { c: [[px0,0,pz1],[px0,plateH,pz1],[px0,plateH,pz0],[px0,0,pz0]], n: [-1,0,0], b: 0.85 },
            { c: [[px1,0,pz1],[px1,plateH,pz1],[px0,plateH,pz1],[px0,0,pz1]], n: [0,0,1], b: 0.9 },
            { c: [[px0,0,pz0],[px0,plateH,pz0],[px1,plateH,pz0],[px1,0,pz0]], n: [0,0,-1], b: 0.9 },
          ];
          for (const f of plateFaces) {
            for (let ci = 0; ci < 4; ci++) {
              positions.push(x + f.c[ci][0], y + f.c[ci][1], z + f.c[ci][2]);
              normals.push(f.n[0], f.n[1], f.n[2]);
              const bright = isOn ? 1.2 : 1.0;
              colors.push(plateColor.r * f.b * bright, plateColor.g * f.b * bright, plateColor.b * f.b * bright);
              uvs.push(whiteUV.u0, whiteUV.v0);
              sparkles.push(0); waterFlags.push(0); lavaFlags.push(0); cableFlags.push(isOn ? 2.0 : 0); glassFlags.push(0); oreColors.push(0, 0, 0);
            }
            indices.push(vertexCount, vertexCount+1, vertexCount+2, vertexCount, vertexCount+2, vertexCount+3);
            vertexCount += 4;
          }
          continue;
        }

        // Detector rail rendering (rail with red pressure plate stripe)
        if (isDetectorRail(block)) {
          const isOn = blockDef.detectorRailOn === true;
          const whiteUV = getWhiteUV();
          const railH = 0.06;
          const tieColor = new THREE.Color(0x8b6914);
          const metalColor = new THREE.Color(isOn ? 0xcc4444 : 0x888888);
          const plateStripeColor = new THREE.Color(isOn ? 0xff4444 : 0xcc3333);

          // Wooden ties (like normal rail)
          const tieW = 0.9, tieD = 0.12, tieH = 0.04;
          const tiePositions = [0.2, 0.5, 0.8];
          for (const tz of tiePositions) {
            const t0x = 0.5 - tieW / 2, t1x = 0.5 + tieW / 2;
            const t0z = tz - tieD / 2, t1z = tz + tieD / 2;
            const tieFaces: [number,number,number][][] = [
              [[t0x,tieH,t1z],[t1x,tieH,t1z],[t1x,tieH,t0z],[t0x,tieH,t0z]],
            ];
            for (const fc of tieFaces) {
              for (let ci = 0; ci < 4; ci++) {
                positions.push(x + fc[ci][0], y + fc[ci][1], z + fc[ci][2]);
                normals.push(0, 1, 0);
                colors.push(tieColor.r * 0.9, tieColor.g * 0.9, tieColor.b * 0.9);
                uvs.push(whiteUV.u0, whiteUV.v0);
                sparkles.push(0); waterFlags.push(0); lavaFlags.push(0); cableFlags.push(isOn ? 2.0 : 0); glassFlags.push(0); oreColors.push(0, 0, 0);
              }
              indices.push(vertexCount, vertexCount+1, vertexCount+2, vertexCount, vertexCount+2, vertexCount+3);
              vertexCount += 4;
            }
          }

          // Two metal rails (NS direction)
          const railW = 0.08;
          const railOffsets = [0.2, 0.8];
          for (const rx of railOffsets) {
            const r0x = rx - railW / 2, r1x = rx + railW / 2;
            const topFace: [number,number,number][] = [[r0x,railH,1],[r1x,railH,1],[r1x,railH,0],[r0x,railH,0]];
            for (let ci = 0; ci < 4; ci++) {
              positions.push(x + topFace[ci][0], y + topFace[ci][1], z + topFace[ci][2]);
              normals.push(0, 1, 0);
              colors.push(metalColor.r, metalColor.g, metalColor.b);
              uvs.push(whiteUV.u0, whiteUV.v0);
              sparkles.push(0); waterFlags.push(0); lavaFlags.push(0); cableFlags.push(isOn ? 2.0 : 0); glassFlags.push(0); oreColors.push(0, 0, 0);
            }
            indices.push(vertexCount, vertexCount+1, vertexCount+2, vertexCount, vertexCount+2, vertexCount+3);
            vertexCount += 4;
          }

          // Center pressure plate stripe
          const stripeW = 0.3;
          const sx0 = 0.5 - stripeW / 2, sx1 = 0.5 + stripeW / 2;
          const stripeFace: [number,number,number][] = [[sx0,railH+0.005,0.1],[sx1,railH+0.005,0.1],[sx1,railH+0.005,0.9],[sx0,railH+0.005,0.9]];
          for (let ci = 0; ci < 4; ci++) {
            positions.push(x + stripeFace[ci][0], y + stripeFace[ci][1], z + stripeFace[ci][2]);
            normals.push(0, 1, 0);
            colors.push(plateStripeColor.r, plateStripeColor.g, plateStripeColor.b);
            uvs.push(whiteUV.u0, whiteUV.v0);
            sparkles.push(0); waterFlags.push(0); lavaFlags.push(0); cableFlags.push(isOn ? 2.0 : 0); glassFlags.push(0); oreColors.push(0, 0, 0);
          }
          indices.push(vertexCount, vertexCount+1, vertexCount+2, vertexCount, vertexCount+2, vertexCount+3);
          vertexCount += 4;
          continue;
        }

        // Repeater rendering (flat slab on ground with directional torch indicators)
        if (isRepeater(block)) {
          const rDef = getBlock(block);
          const isOn = rDef.repeaterOn === true;
          const dir = rDef.repeaterDir ?? 'n';
          const whiteUV = getWhiteUV();
          const baseColor = new THREE.Color(0x606060); // dark stone base
          const torchColorOff = new THREE.Color(0x661111); // dim red torch
          const torchColorOn = new THREE.Color(0xff3333); // bright red torch
          const torchColor = isOn ? torchColorOn : torchColorOff;
          const arrowColor = new THREE.Color(isOn ? 0xcc4444 : 0x444444);

          // Base slab (flat on floor, slightly raised)
          const baseH = 0.12;
          const inset = 0.05;
          const baseFaces: { c: [number,number,number][]; n: [number,number,number]; b: number }[] = [
            { c: [[inset,baseH,1-inset],[1-inset,baseH,1-inset],[1-inset,baseH,inset],[inset,baseH,inset]], n: [0,1,0], b: 1.0 },
            { c: [[inset,0,inset],[1-inset,0,inset],[1-inset,0,1-inset],[inset,0,1-inset]], n: [0,-1,0], b: 0.7 },
            { c: [[1-inset,0,inset],[1-inset,baseH,inset],[1-inset,baseH,1-inset],[1-inset,0,1-inset]], n: [1,0,0], b: 0.85 },
            { c: [[inset,0,1-inset],[inset,baseH,1-inset],[inset,baseH,inset],[inset,0,inset]], n: [-1,0,0], b: 0.85 },
            { c: [[1-inset,0,1-inset],[1-inset,baseH,1-inset],[inset,baseH,1-inset],[inset,0,1-inset]], n: [0,0,1], b: 0.9 },
            { c: [[inset,0,inset],[inset,baseH,inset],[1-inset,baseH,inset],[1-inset,0,inset]], n: [0,0,-1], b: 0.9 },
          ];
          for (const f of baseFaces) {
            for (let ci = 0; ci < 4; ci++) {
              positions.push(x + f.c[ci][0], y + f.c[ci][1], z + f.c[ci][2]);
              normals.push(f.n[0], f.n[1], f.n[2]);
              colors.push(baseColor.r * f.b, baseColor.g * f.b, baseColor.b * f.b);
              uvs.push(whiteUV.u0, whiteUV.v0);
              sparkles.push(0); waterFlags.push(0); lavaFlags.push(0); cableFlags.push(isOn ? 2.0 : 0); glassFlags.push(0); oreColors.push(0, 0, 0);
            }
            indices.push(vertexCount, vertexCount+1, vertexCount+2, vertexCount, vertexCount+2, vertexCount+3);
            vertexCount += 4;
          }

          // Two torches on the base - positions depend on direction
          // Input torch (back) and output torch (front)
          const torchR = 0.07;
          const torchH = 0.22;
          // Direction-dependent positions: [inputX, inputZ, outputX, outputZ]
          let tIn: [number, number], tOut: [number, number];
          let arrowStart: [number, number], arrowEnd: [number, number];
          switch (dir) {
            case 'n': tIn = [0.5, 0.7]; tOut = [0.5, 0.3]; arrowStart = [0.5, 0.6]; arrowEnd = [0.5, 0.2]; break;
            case 's': tIn = [0.5, 0.3]; tOut = [0.5, 0.7]; arrowStart = [0.5, 0.4]; arrowEnd = [0.5, 0.8]; break;
            case 'e': tIn = [0.3, 0.5]; tOut = [0.7, 0.5]; arrowStart = [0.4, 0.5]; arrowEnd = [0.8, 0.5]; break;
            case 'w': tIn = [0.7, 0.5]; tOut = [0.3, 0.5]; arrowStart = [0.6, 0.5]; arrowEnd = [0.2, 0.5]; break;
          }

          // Draw two torch dots on top surface
          for (const [tx, tz] of [tIn, tOut]) {
            const topFace: [number,number,number][] = [
              [tx - torchR, baseH + torchH, tz + torchR],
              [tx + torchR, baseH + torchH, tz + torchR],
              [tx + torchR, baseH + torchH, tz - torchR],
              [tx - torchR, baseH + torchH, tz - torchR],
            ];
            for (let ci = 0; ci < 4; ci++) {
              positions.push(x + topFace[ci][0], y + topFace[ci][1], z + topFace[ci][2]);
              normals.push(0, 1, 0);
              colors.push(torchColor.r, torchColor.g, torchColor.b);
              uvs.push(whiteUV.u0, whiteUV.v0);
              sparkles.push(0); waterFlags.push(0); lavaFlags.push(0); cableFlags.push(isOn ? 2.0 : 0); glassFlags.push(0); oreColors.push(0, 0, 0);
            }
            indices.push(vertexCount, vertexCount+1, vertexCount+2, vertexCount, vertexCount+2, vertexCount+3);
            vertexCount += 4;
          }

          // Direction arrow stripe on top surface
          const aw = 0.04; // arrow half-width
          let arrowFace: [number,number,number][];
          if (dir === 'n' || dir === 's') {
            arrowFace = [
              [arrowStart[0] - aw, baseH + 0.005, arrowEnd[1]],
              [arrowStart[0] + aw, baseH + 0.005, arrowEnd[1]],
              [arrowEnd[0] + aw, baseH + 0.005, arrowStart[1]],
              [arrowEnd[0] - aw, baseH + 0.005, arrowStart[1]],
            ];
          } else {
            arrowFace = [
              [arrowStart[0], baseH + 0.005, arrowStart[1] - aw],
              [arrowEnd[0], baseH + 0.005, arrowEnd[1] - aw],
              [arrowEnd[0], baseH + 0.005, arrowEnd[1] + aw],
              [arrowStart[0], baseH + 0.005, arrowStart[1] + aw],
            ];
          }
          for (let ci = 0; ci < 4; ci++) {
            positions.push(x + arrowFace[ci][0], y + arrowFace[ci][1], z + arrowFace[ci][2]);
            normals.push(0, 1, 0);
            colors.push(arrowColor.r, arrowColor.g, arrowColor.b);
            uvs.push(whiteUV.u0, whiteUV.v0);
            sparkles.push(0); waterFlags.push(0); lavaFlags.push(0); cableFlags.push(isOn ? 2.0 : 0); glassFlags.push(0); oreColors.push(0, 0, 0);
          }
          indices.push(vertexCount, vertexCount+1, vertexCount+2, vertexCount, vertexCount+2, vertexCount+3);
          vertexCount += 4;
          continue;
        }

        // Comparator rendering (flat slab with 3 torch indicators in triangle)
        if (isComparator(block)) {
          const cDef = getBlock(block);
          const isOn = cDef.comparatorOn === true;
          const dir = cDef.comparatorDir ?? 'n';
          const whiteUV = getWhiteUV();
          const baseColor = new THREE.Color(0x606060);
          const torchColorOff = new THREE.Color(0x661111);
          const torchColorOn = new THREE.Color(0xff3333);
          const frontTorchColor = isOn ? torchColorOn : torchColorOff;

          // Base slab (same as repeater)
          const baseH = 0.12;
          const inset = 0.05;
          const baseFaces: { c: [number,number,number][]; n: [number,number,number]; b: number }[] = [
            { c: [[inset,baseH,1-inset],[1-inset,baseH,1-inset],[1-inset,baseH,inset],[inset,baseH,inset]], n: [0,1,0], b: 1.0 },
            { c: [[inset,0,inset],[1-inset,0,inset],[1-inset,0,1-inset],[inset,0,1-inset]], n: [0,-1,0], b: 0.7 },
            { c: [[1-inset,0,inset],[1-inset,baseH,inset],[1-inset,baseH,1-inset],[1-inset,0,1-inset]], n: [1,0,0], b: 0.85 },
            { c: [[inset,0,1-inset],[inset,baseH,1-inset],[inset,baseH,inset],[inset,0,inset]], n: [-1,0,0], b: 0.85 },
            { c: [[1-inset,0,1-inset],[1-inset,baseH,1-inset],[inset,baseH,1-inset],[inset,0,1-inset]], n: [0,0,1], b: 0.9 },
            { c: [[inset,0,inset],[inset,baseH,inset],[1-inset,baseH,inset],[1-inset,0,inset]], n: [0,0,-1], b: 0.9 },
          ];
          for (const f of baseFaces) {
            for (let ci = 0; ci < 4; ci++) {
              positions.push(x + f.c[ci][0], y + f.c[ci][1], z + f.c[ci][2]);
              normals.push(f.n[0], f.n[1], f.n[2]);
              colors.push(baseColor.r * f.b, baseColor.g * f.b, baseColor.b * f.b);
              uvs.push(whiteUV.u0, whiteUV.v0);
              sparkles.push(0); waterFlags.push(0); lavaFlags.push(0); cableFlags.push(isOn ? 2.0 : 0); glassFlags.push(0); oreColors.push(0, 0, 0);
            }
            indices.push(vertexCount, vertexCount+1, vertexCount+2, vertexCount, vertexCount+2, vertexCount+3);
            vertexCount += 4;
          }

          // Three torches: 1 front (output), 2 back sides (inputs)
          const torchR = 0.07;
          const torchH = 0.22;
          let tFront: [number, number], tBackL: [number, number], tBackR: [number, number];
          switch (dir) {
            case 'n':
              tFront = [0.5, 0.25]; tBackL = [0.25, 0.75]; tBackR = [0.75, 0.75]; break;
            case 's':
              tFront = [0.5, 0.75]; tBackL = [0.75, 0.25]; tBackR = [0.25, 0.25]; break;
            case 'e':
              tFront = [0.75, 0.5]; tBackL = [0.25, 0.25]; tBackR = [0.25, 0.75]; break;
            case 'w':
              tFront = [0.25, 0.5]; tBackL = [0.75, 0.75]; tBackR = [0.75, 0.25]; break;
          }

          // Draw three torches
          const torches: { pos: [number, number]; col: THREE.Color }[] = [
            { pos: tFront, col: frontTorchColor },
            { pos: tBackL, col: torchColorOff },
            { pos: tBackR, col: torchColorOff },
          ];
          for (const torch of torches) {
            const [tx, tz] = torch.pos;
            const topFace: [number,number,number][] = [
              [tx - torchR, baseH + torchH, tz + torchR],
              [tx + torchR, baseH + torchH, tz + torchR],
              [tx + torchR, baseH + torchH, tz - torchR],
              [tx - torchR, baseH + torchH, tz - torchR],
            ];
            for (let ci = 0; ci < 4; ci++) {
              positions.push(x + topFace[ci][0], y + topFace[ci][1], z + topFace[ci][2]);
              normals.push(0, 1, 0);
              colors.push(torch.col.r, torch.col.g, torch.col.b);
              uvs.push(whiteUV.u0, whiteUV.v0);
              sparkles.push(0); waterFlags.push(0); lavaFlags.push(0); cableFlags.push(isOn ? 2.0 : 0); glassFlags.push(0); oreColors.push(0, 0, 0);
            }
            indices.push(vertexCount, vertexCount+1, vertexCount+2, vertexCount, vertexCount+2, vertexCount+3);
            vertexCount += 4;
          }
          continue;
        }

        // Normal cube rendering

        for (const face of FACES) {
          const nx = x + face.dir[0];
          const ny = y + face.dir[1];
          const nz = z + face.dir[2];

          let neighborBlock: BlockType;
          if (nx >= 0 && nx < CHUNK_SIZE && ny >= 0 && ny < CHUNK_HEIGHT && nz >= 0 && nz < CHUNK_SIZE) {
            neighborBlock = chunk.getBlock(nx, ny, nz);
          } else if (getNeighborBlock) {
            neighborBlock = getNeighborBlock(ox + nx, ny, oz + nz);
          } else {
            neighborBlock = BlockType.AIR;
          }

          if (!isTransparent(neighborBlock) && neighborBlock !== BlockType.AIR) continue;
          if (neighborBlock === block) continue;

          const faceBrightness = face.faceName === 'top' ? 1.0 : face.faceName === 'side' ? 0.85 : 0.7;
          const atlas = getAtlasUV(block, face.faceName);

          for (let ci = 0; ci < face.corners.length; ci++) {
            const corner = face.corners[ci];
            const vx = x + corner[0];
            const vy = y + corner[1];
            const vz = z + corner[2];

            positions.push(vx, vy, vz);
            normals.push(face.dir[0], face.dir[1], face.dir[2]);

            const ao = computeAO(chunk, x, y, z, face, ci, ox, oz, getNeighborBlock);
            const brightness = faceBrightness * ao;

            // Store brightness as vertex color - texture provides the actual color
            colors.push(brightness, brightness, brightness);

            // Map face UVs [0,1] into atlas sub-rectangle
            const u = atlas.u0 + face.uvs[ci][0] * (atlas.u1 - atlas.u0);
            const v = atlas.v0 + face.uvs[ci][1] * (atlas.v1 - atlas.v0);
            uvs.push(u, v);
            sparkles.push(sparkle);
            waterFlags.push(isWater); lavaFlags.push(isLavaBlock); cableFlags.push(cableVal); glassFlags.push(isGlassBlock);
            oreColors.push(
              oreColor ? oreColor.r : 1.0,
              oreColor ? oreColor.g : 0.95,
              oreColor ? oreColor.b : 0.8,
            );
          }

          indices.push(
            vertexCount, vertexCount + 1, vertexCount + 2,
            vertexCount, vertexCount + 2, vertexCount + 3
          );
          vertexCount += 4;
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('aSparkle', new THREE.Float32BufferAttribute(sparkles, 1));
  geometry.setAttribute('aIsWater', new THREE.Float32BufferAttribute(waterFlags, 1));
  geometry.setAttribute('aIsLava', new THREE.Float32BufferAttribute(lavaFlags, 1));
  geometry.setAttribute('aIsCable', new THREE.Float32BufferAttribute(cableFlags, 1));
  geometry.setAttribute('aIsGlass', new THREE.Float32BufferAttribute(glassFlags, 1));
  geometry.setAttribute('aOreColor', new THREE.Float32BufferAttribute(oreColors, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();

  return geometry;
}
