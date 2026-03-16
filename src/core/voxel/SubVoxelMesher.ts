/**
 * SubVoxelMesher: generates geometry for blocks with sub-voxel damage.
 * Each sub-voxel is 1/4 of a block (SUB_VOXEL_RES=4), so each is 0.25×0.25×0.25 units.
 * Uses face culling between adjacent sub-voxels and neighbor blocks.
 */

import * as THREE from 'three';
import { BlockType, getBlock, isTransparent } from './BlockRegistry';
import { SubVoxelStore, SUB_VOXEL_RES } from './SubVoxelData';
import { getWhiteUV } from './TextureAtlas';
import type { BlockDefinition } from './BlockRegistry';

const SV_SIZE = 1.0 / SUB_VOXEL_RES; // 0.25

// 6 face directions for sub-voxel face culling
const SV_FACES: Array<{
  dir: [number, number, number];
  corners: [number, number, number][];
  faceName: 'top' | 'bottom' | 'side';
}> = [
  // +Y (top)
  { dir: [0, 1, 0], corners: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]], faceName: 'top' },
  // -Y (bottom)
  { dir: [0, -1, 0], corners: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]], faceName: 'bottom' },
  // +X
  { dir: [1, 0, 0], corners: [[1,0,0],[1,1,0],[1,1,1],[1,0,1]], faceName: 'side' },
  // -X
  { dir: [-1, 0, 0], corners: [[0,0,1],[0,1,1],[0,1,0],[0,0,0]], faceName: 'side' },
  // +Z
  { dir: [0, 0, 1], corners: [[1,0,1],[1,1,1],[0,1,1],[0,0,1]], faceName: 'side' },
  // -Z
  { dir: [0, 0, -1], corners: [[0,0,0],[0,1,0],[1,1,0],[1,0,0]], faceName: 'side' },
];

function hash3(x: number, y: number, z: number): number {
  let h = (x * 374761393 + y * 668265263 + z * 1274126177) | 0;
  h = ((h ^ (h >> 13)) * 1274126177) | 0;
  return (h & 0x7fffffff) / 0x7fffffff;
}

/**
 * Check if a sub-voxel neighbor is solid.
 * If the neighbor is outside the block, check neighbor blocks via getNeighborBlock.
 */
function isNeighborSolid(
  store: SubVoxelStore,
  wx: number, wy: number, wz: number,
  sx: number, sy: number, sz: number,
  getNeighborBlock: (wx: number, wy: number, wz: number) => BlockType
): boolean {
  // Neighbor sub-voxel is within the same block
  if (sx >= 0 && sx < SUB_VOXEL_RES && sy >= 0 && sy < SUB_VOXEL_RES && sz >= 0 && sz < SUB_VOXEL_RES) {
    return store.getSubVoxel(wx, wy, wz, sx, sy, sz) !== 0;
  }

  // Neighbor is in an adjacent block
  let nwx = wx, nwy = wy, nwz = wz;
  let nsx = sx, nsy = sy, nsz = sz;

  if (sx < 0) { nwx--; nsx = SUB_VOXEL_RES - 1; }
  else if (sx >= SUB_VOXEL_RES) { nwx++; nsx = 0; }
  if (sy < 0) { nwy--; nsy = SUB_VOXEL_RES - 1; }
  else if (sy >= SUB_VOXEL_RES) { nwy++; nsy = 0; }
  if (sz < 0) { nwz--; nsz = SUB_VOXEL_RES - 1; }
  else if (sz >= SUB_VOXEL_RES) { nwz++; nsz = 0; }

  // Check if neighbor block has a sub-voxel grid
  if (store.hasGrid(nwx, nwy, nwz)) {
    return store.getSubVoxel(nwx, nwy, nwz, nsx, nsy, nsz) !== 0;
  }

  // No grid = check if neighbor block type is solid
  const neighborType = getNeighborBlock(nwx, nwy, nwz);
  if (neighborType === BlockType.AIR) return false;
  if (isTransparent(neighborType)) return false;
  return true;
}

/**
 * Build geometry for a single block with sub-voxel data.
 * Produces a BufferGeometry compatible with the main voxel shader.
 */
export function buildSubVoxelGeometry(
  store: SubVoxelStore,
  wx: number, wy: number, wz: number,
  blockDef: BlockDefinition,
  getNeighborBlock: (wx: number, wy: number, wz: number) => BlockType
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

  const baseColor = blockDef.color;
  const topColor = blockDef.topColor;
  const sparkle = blockDef.sparkle ?? 0;
  const oreColor = blockDef.oreColor;
  const wuv = getWhiteUV();

  for (let sy = 0; sy < SUB_VOXEL_RES; sy++) {
    for (let sz = 0; sz < SUB_VOXEL_RES; sz++) {
      for (let sx = 0; sx < SUB_VOXEL_RES; sx++) {
        // Skip empty sub-voxels
        const val = store.getSubVoxel(wx, wy, wz, sx, sy, sz);
        if (val === 0) continue;

        for (const face of SV_FACES) {
          // Check neighbor in face direction
          const nsx = sx + face.dir[0];
          const nsy = sy + face.dir[1];
          const nsz = sz + face.dir[2];

          if (isNeighborSolid(store, wx, wy, wz, nsx, nsy, nsz, getNeighborBlock)) {
            continue; // neighbor is solid, skip face
          }

          // Emit face quad
          const faceBrightness = face.faceName === 'top' ? 1.0 : face.faceName === 'side' ? 0.85 : 0.7;

          // Determine color based on face position (top of block gets topColor)
          const isTopOfBlock = sy === SUB_VOXEL_RES - 1 && face.faceName === 'top';
          const faceColor = (isTopOfBlock && topColor) ? topColor : baseColor;

          for (let ci = 0; ci < 4; ci++) {
            const corner = face.corners[ci];
            // Position: block offset + sub-voxel offset + corner within sub-voxel
            const vx = wx + (sx + corner[0]) * SV_SIZE;
            const vy = wy + (sy + corner[1]) * SV_SIZE;
            const vz = wz + (sz + corner[2]) * SV_SIZE;

            positions.push(vx, vy, vz);
            normals.push(face.dir[0], face.dir[1], face.dir[2]);

            // Per-vertex color with slight noise variation
            const noise = (hash3(
              (wx * SUB_VOXEL_RES + sx) * 7 + ci,
              (wy * SUB_VOXEL_RES + sy) * 3,
              (wz * SUB_VOXEL_RES + sz) * 7 + ci
            ) - 0.5) * 0.08;

            const brightness = faceBrightness;
            colors.push(
              Math.max(0, Math.min(1, faceColor.r * brightness + noise)),
              Math.max(0, Math.min(1, faceColor.g * brightness + noise)),
              Math.max(0, Math.min(1, faceColor.b * brightness + noise * 0.5)),
            );

            // Use white UV (solid color, no texture pattern needed for sub-voxels)
            const lu = ci % 2 === 0 ? 0 : 1;
            const lv = corner[1] > 0.5 ? 1 : 0;
            uvs.push(
              wuv.u0 + lu * (wuv.u1 - wuv.u0),
              wuv.v0 + lv * (wuv.v1 - wuv.v0)
            );

            sparkles.push(sparkle);
            waterFlags.push(0);
            lavaFlags.push(0);
            cableFlags.push(0);
            glassFlags.push(0);
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
