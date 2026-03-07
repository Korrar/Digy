import * as THREE from 'three';
import { BlockType, getBlock, getBlockColor, isTransparent, isCrossedQuad } from './BlockRegistry';
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
