import * as THREE from 'three';
import { BlockType, getBlock, getBlockColor, isTransparent, isCrossedQuad, isFlat } from './BlockRegistry';
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

          // Check neighbors for rail connections
          const isRailBlock = (lx: number, ly: number, lz: number): boolean => {
            if (lx >= 0 && lx < CHUNK_SIZE && ly >= 0 && ly < CHUNK_HEIGHT && lz >= 0 && lz < CHUNK_SIZE) {
              return isFlat(chunk.getBlock(lx, ly, lz));
            } else if (getNeighborBlock) {
              return isFlat(getNeighborBlock(ox + lx, ly, oz + lz));
            }
            return false;
          };

          const hasNorth = isRailBlock(x, y, z - 1); // -Z
          const hasSouth = isRailBlock(x, y, z + 1); // +Z
          const hasEast = isRailBlock(x + 1, y, z);  // +X
          const hasWest = isRailBlock(x - 1, y, z);  // -X

          // Determine rail shape: 'ns' | 'ew' | 'curve_ne' | 'curve_nw' | 'curve_se' | 'curve_sw'
          type RailShape = 'ns' | 'ew' | 'curve_ne' | 'curve_nw' | 'curve_se' | 'curve_sw';
          let shape: RailShape = 'ns'; // default: straight north-south

          // Powered rails don't curve
          if (!isPowered) {
            if (hasNorth && hasEast && !hasSouth && !hasWest) shape = 'curve_ne';
            else if (hasNorth && hasWest && !hasSouth && !hasEast) shape = 'curve_nw';
            else if (hasSouth && hasEast && !hasNorth && !hasWest) shape = 'curve_se';
            else if (hasSouth && hasWest && !hasNorth && !hasEast) shape = 'curve_sw';
            else if (hasEast || hasWest) {
              if (!hasNorth && !hasSouth) shape = 'ew';
              else shape = 'ns'; // prefer NS when both axes have neighbors
            }
          } else {
            // Powered rails: only straight, pick orientation
            if ((hasEast || hasWest) && !hasNorth && !hasSouth) shape = 'ew';
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

            // Curved ties
            for (let s = 0; s < CURVE_SEGMENTS; s++) {
              const t = (s + 0.5) / CURVE_SEGMENTS;
              const angle = startAngle + t * angleSpan;
              const cx = pivotX + Math.cos(angle) * 0.5;
              const cz = pivotZ + Math.sin(angle) * 0.5;
              // Tie perpendicular to curve direction
              const tx = -Math.sin(angle) * 0.45;
              const tz = Math.cos(angle) * 0.45;
              const tw = Math.cos(angle) * 0.06;
              const th = Math.sin(angle) * 0.06;
              addQuad(
                [[cx - tx + tw, tieHeight, cz - tz + th],
                 [cx + tx + tw, tieHeight, cz + tz + th],
                 [cx + tx - tw, tieHeight, cz + tz - th],
                 [cx - tx - tw, tieHeight, cz - tz - th]],
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

          // Bottom face (same for all shapes)
          addQuad(
            [[0.05, 0, 0.05], [0.95, 0, 0.05],
             [0.95, 0, 0.95], [0.05, 0, 0.95]],
            [0, -1, 0],
            new THREE.Color(tieColor.r * 0.6, tieColor.g * 0.6, tieColor.b * 0.6)
          );

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
