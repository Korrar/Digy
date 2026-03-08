import * as THREE from 'three';
import { BlockType, getBlock, getBlockColor, isTransparent, isCrossedQuad, isFlat, isSlab, isFence, isStairs, isDoor } from './BlockRegistry';
import { ChunkData } from './ChunkData';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '../../utils/constants';

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

function getTextureVariation(block: BlockType): number {
  switch (block) {
    case BlockType.GRASS: return 0.12;
    case BlockType.DIRT: return 0.10;
    case BlockType.STONE: return 0.15;
    case BlockType.SAND: return 0.08;
    case BlockType.SANDSTONE: return 0.10;
    case BlockType.GRAVEL: return 0.18;
    case BlockType.COBBLESTONE: return 0.16;
    case BlockType.SNOW: return 0.04;
    case BlockType.WOOD: return 0.08;
    case BlockType.LEAVES: return 0.14;
    case BlockType.COAL_ORE: return 0.20;
    case BlockType.IRON_ORE: return 0.18;
    case BlockType.GOLD_ORE: return 0.15;
    case BlockType.DIAMOND_ORE: return 0.12;
    case BlockType.ICE: return 0.06;
    case BlockType.CACTUS: return 0.10;
    case BlockType.WATER: return 0.05;
    case BlockType.PLANKS: return 0.08;
    case BlockType.STONE_BRICKS: return 0.12;
    case BlockType.CLAY: return 0.06;
    case BlockType.MUD: return 0.14;
    case BlockType.BOOKSHELF: return 0.10;
    default: return 0.05;
  }
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

export type RailShape = 'ns' | 'ew' | 'curve_ne' | 'curve_nw' | 'curve_se' | 'curve_sw';

/** Map from curve block type to RailShape */
const CURVE_BLOCK_TO_SHAPE: Partial<Record<BlockType, RailShape>> = {
  [BlockType.RAIL_CURVE_NE]: 'curve_ne',
  [BlockType.RAIL_CURVE_NW]: 'curve_nw',
  [BlockType.RAIL_CURVE_SE]: 'curve_se',
  [BlockType.RAIL_CURVE_SW]: 'curve_sw',
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

  // Curve block types: return stored shape directly (like Minecraft)
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
 * Compute what block type a rail at (x,y,z) should be, considering neighbors.
 * Used at placement time and for neighbor updates.
 * For 3+ neighbors (T-junction), uses 2nd-degree neighbor check.
 */
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

  const count = (hasNorth ? 1 : 0) + (hasSouth ? 1 : 0) + (hasEast ? 1 : 0) + (hasWest ? 1 : 0);

  // 4-way: south-east curve
  if (count === 4) return BlockType.RAIL_CURVE_SE;

  // T-junction: smart connectivity using 2nd-degree neighbors
  if (count === 3) {
    if (hasNorth && hasSouth && hasEast && !hasWest) {
      const sEastRail = isFlat(getBlockAt(x + 1, y, z + 1));
      const nEastRail = isFlat(getBlockAt(x + 1, y, z - 1));
      if (sEastRail && !nEastRail) return BlockType.RAIL_CURVE_NE;
      if (nEastRail && !sEastRail) return BlockType.RAIL_CURVE_SE;
      return BlockType.RAIL_CURVE_SE;
    }
    if (hasNorth && hasSouth && !hasEast && hasWest) {
      const sWestRail = isFlat(getBlockAt(x - 1, y, z + 1));
      const nWestRail = isFlat(getBlockAt(x - 1, y, z - 1));
      if (sWestRail && !nWestRail) return BlockType.RAIL_CURVE_NW;
      if (nWestRail && !sWestRail) return BlockType.RAIL_CURVE_SW;
      return BlockType.RAIL_CURVE_SW;
    }
    if (hasNorth && !hasSouth && hasEast && hasWest) {
      const wNorthRail = isFlat(getBlockAt(x - 1, y, z - 1));
      const eNorthRail = isFlat(getBlockAt(x + 1, y, z - 1));
      if (wNorthRail && !eNorthRail) return BlockType.RAIL_CURVE_NE;
      if (eNorthRail && !wNorthRail) return BlockType.RAIL_CURVE_NW;
      return BlockType.RAIL_CURVE_NE;
    }
    if (!hasNorth && hasSouth && hasEast && hasWest) {
      const wSouthRail = isFlat(getBlockAt(x - 1, y, z + 1));
      const eSouthRail = isFlat(getBlockAt(x + 1, y, z + 1));
      if (wSouthRail && !eSouthRail) return BlockType.RAIL_CURVE_SE;
      if (eSouthRail && !wSouthRail) return BlockType.RAIL_CURVE_SW;
      return BlockType.RAIL_CURVE_SE;
    }
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

              uvs.push(ci % 2 === 0 ? 0 : 1, corner[1] > 0.5 ? 1 : 0);
              sparkles.push(0);
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
              uvs.push(ci % 2 === 0 ? 0 : 1, ci < 2 ? 0 : 1);
              sparkles.push(0);
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

        // Slab rendering (half-height block)
        if (isSlab(block)) {
          const slabColor = blockDef.color;
          const variation = getTextureVariation(block);

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
            for (let ci = 0; ci < 4; ci++) {
              const corner = face.corners[ci];
              positions.push(x + corner[0], y + corner[1], z + corner[2]);
              normals.push(face.dir[0], face.dir[1], face.dir[2]);
              const noiseVal = (hash3(wx + corner[0], y + corner[1], wz + corner[2]) - 0.5) * 2;
              const texNoise = noiseVal * variation;
              colors.push(
                Math.max(0, Math.min(1, slabColor.r * faceBrightness + texNoise)),
                Math.max(0, Math.min(1, slabColor.g * faceBrightness + texNoise * 0.8)),
                Math.max(0, Math.min(1, slabColor.b * faceBrightness + texNoise * 0.6)),
              );
              uvs.push(face.uvs[ci][0], face.uvs[ci][1]);
              sparkles.push(0);
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
            col: THREE.Color
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
              for (let ci = 0; ci < 4; ci++) {
                const c = bf.corners[ci];
                positions.push(x + c[0], y + c[1], z + c[2]);
                normals.push(bf.normal[0], bf.normal[1], bf.normal[2]);
                const v = (hash3(wx * 5 + ci, y * 3 + c[1] * 10, wz * 5 + ci) - 0.5) * 0.08;
                colors.push(
                  Math.max(0, Math.min(1, col.r * bf.brightness + v)),
                  Math.max(0, Math.min(1, col.g * bf.brightness + v)),
                  Math.max(0, Math.min(1, col.b * bf.brightness + v)),
                );
                uvs.push(ci % 2 === 0 ? 0 : 1, ci < 2 ? 0 : 1);
                sparkles.push(0);
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
            col: THREE.Color
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
              for (let ci = 0; ci < 4; ci++) {
                const c = bf.corners[ci];
                positions.push(x + c[0], y + c[1], z + c[2]);
                normals.push(bf.normal[0], bf.normal[1], bf.normal[2]);
                const v = (hash3(wx * 5 + ci, y * 3 + c[1] * 10, wz * 5 + ci) - 0.5) * 0.08;
                colors.push(
                  Math.max(0, Math.min(1, col.r * bf.brightness + v)),
                  Math.max(0, Math.min(1, col.g * bf.brightness + v)),
                  Math.max(0, Math.min(1, col.b * bf.brightness + v)),
                );
                uvs.push(ci % 2 === 0 ? 0 : 1, ci < 2 ? 0 : 1);
                sparkles.push(0);
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
            col: THREE.Color
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
              for (let ci = 0; ci < 4; ci++) {
                const c = bf.corners[ci];
                positions.push(x + c[0], y + c[1], z + c[2]);
                normals.push(bf.normal[0], bf.normal[1], bf.normal[2]);
                const v = (hash3(wx * 5 + ci, y * 3 + c[1] * 10, wz * 5 + ci) - 0.5) * 0.06;
                colors.push(
                  Math.max(0, Math.min(1, col.r * bf.brightness + v)),
                  Math.max(0, Math.min(1, col.g * bf.brightness + v)),
                  Math.max(0, Math.min(1, col.b * bf.brightness + v)),
                );
                uvs.push(ci % 2 === 0 ? 0 : 1, ci < 2 ? 0 : 1);
                sparkles.push(0);
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

        // Normal cube rendering
        const variation = getTextureVariation(block);

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

          const color = getBlockColor(block, face.faceName);
          const faceBrightness = face.faceName === 'top' ? 1.0 : face.faceName === 'side' ? 0.85 : 0.7;

          for (let ci = 0; ci < face.corners.length; ci++) {
            const corner = face.corners[ci];
            const vx = x + corner[0];
            const vy = y + corner[1];
            const vz = z + corner[2];

            positions.push(vx, vy, vz);
            normals.push(face.dir[0], face.dir[1], face.dir[2]);

            const ao = computeAO(chunk, x, y, z, face, ci, ox, oz, getNeighborBlock);

            const noiseVal = (hash3(wx + corner[0], y + corner[1], wz + corner[2]) - 0.5) * 2;
            const noiseVal2 = (hash3(wx * 3 + 7, (y + corner[1]) * 3 + 13, wz * 3 + 19) - 0.5) * 2;
            const texNoise = (noiseVal * 0.7 + noiseVal2 * 0.3) * variation;

            const brightness = faceBrightness * ao;
            let cr = color.r * brightness + texNoise;
            let cg = color.g * brightness + texNoise * 0.8;
            let cb = color.b * brightness + texNoise * 0.6;

            if (oreColor) {
              const speckleNoise = hash3(wx * 7 + corner[0] * 31, (y + corner[1]) * 13 + 97, wz * 7 + corner[2] * 31);
              if (speckleNoise > 0.45) {
                const blend = (speckleNoise - 0.45) / 0.55;
                const t = blend * 0.7;
                cr = cr * (1 - t) + oreColor.r * brightness * t;
                cg = cg * (1 - t) + oreColor.g * brightness * t;
                cb = cb * (1 - t) + oreColor.b * brightness * t;
              }
            }

            colors.push(
              Math.max(0, Math.min(1, cr)),
              Math.max(0, Math.min(1, cg)),
              Math.max(0, Math.min(1, cb)),
            );

            uvs.push(face.uvs[ci][0], face.uvs[ci][1]);
            sparkles.push(sparkle);
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
  geometry.setAttribute('aOreColor', new THREE.Float32BufferAttribute(oreColors, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();

  return geometry;
}
