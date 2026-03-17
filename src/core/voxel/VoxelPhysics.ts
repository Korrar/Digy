/**
 * VoxelPhysics: stability checks for sub-voxel fragments.
 * Uses flood-fill to detect disconnected sub-voxel groups that should fall.
 */

import { SubVoxelStore, SUB_VOXEL_RES } from './SubVoxelData';

const GRID_SIZE = SUB_VOXEL_RES * SUB_VOXEL_RES * SUB_VOXEL_RES;
const STABILITY_THRESHOLD = 0.25; // Block collapses when < 25% sub-voxels remain

interface SubVoxelCoord {
  sx: number;
  sy: number;
  sz: number;
}

function svIndex(sx: number, sy: number, sz: number): number {
  return sy * SUB_VOXEL_RES * SUB_VOXEL_RES + sz * SUB_VOXEL_RES + sx;
}

/**
 * Find disconnected sub-voxel groups within a block using flood-fill.
 * The "grounded" group is the largest connected group that touches the bottom (y=0).
 * Returns arrays of disconnected fragment coordinates (not including the grounded group).
 */
export function findDisconnectedFragments(
  store: SubVoxelStore,
  wx: number, wy: number, wz: number
): SubVoxelCoord[][] {
  const grid = store.getGrid(wx, wy, wz);
  if (!grid) return []; // No grid = fully solid, no fragments

  // Build visited array and find all solid sub-voxels
  const visited = new Uint8Array(GRID_SIZE);
  const groups: SubVoxelCoord[][] = [];

  // Flood-fill to find connected components
  for (let sy = 0; sy < SUB_VOXEL_RES; sy++) {
    for (let sz = 0; sz < SUB_VOXEL_RES; sz++) {
      for (let sx = 0; sx < SUB_VOXEL_RES; sx++) {
        const idx = svIndex(sx, sy, sz);
        if (grid[idx] === 0 || visited[idx]) continue;

        // BFS flood-fill from this sub-voxel
        const group: SubVoxelCoord[] = [];
        let touchesBottom = false;
        const queue: SubVoxelCoord[] = [{ sx, sy, sz }];
        visited[idx] = 1;

        while (queue.length > 0) {
          const cur = queue.pop()!;
          group.push(cur);

          if (cur.sy === 0) touchesBottom = true;

          // Check 6 neighbors
          const neighbors: [number, number, number][] = [
            [cur.sx - 1, cur.sy, cur.sz],
            [cur.sx + 1, cur.sy, cur.sz],
            [cur.sx, cur.sy - 1, cur.sz],
            [cur.sx, cur.sy + 1, cur.sz],
            [cur.sx, cur.sy, cur.sz - 1],
            [cur.sx, cur.sy, cur.sz + 1],
          ];

          for (const [nx, ny, nz] of neighbors) {
            if (nx < 0 || nx >= SUB_VOXEL_RES ||
                ny < 0 || ny >= SUB_VOXEL_RES ||
                nz < 0 || nz >= SUB_VOXEL_RES) continue;

            const nIdx = svIndex(nx, ny, nz);
            if (grid[nIdx] === 0 || visited[nIdx]) continue;

            visited[nIdx] = 1;
            queue.push({ sx: nx, sy: ny, sz: nz });
          }
        }

        if (!touchesBottom) {
          groups.push(group);
        }
      }
    }
  }

  return groups;
}

/**
 * Check if a block has enough sub-voxels to remain stable.
 * Returns false if the block should collapse (< 25% remaining).
 */
export function checkBlockStability(
  store: SubVoxelStore,
  wx: number, wy: number, wz: number
): boolean {
  if (!store.hasGrid(wx, wy, wz)) return true; // No grid = fully solid

  const solid = store.countSolid(wx, wy, wz);
  return solid / GRID_SIZE > STABILITY_THRESHOLD;
}

/**
 * Remove disconnected fragments from a block's sub-voxel grid.
 * Returns the fragments that were removed (for particle spawning).
 */
export function removeDisconnectedFragments(
  store: SubVoxelStore,
  wx: number, wy: number, wz: number
): SubVoxelCoord[][] {
  const fragments = findDisconnectedFragments(store, wx, wy, wz);

  for (const fragment of fragments) {
    for (const { sx, sy, sz } of fragment) {
      store.setSubVoxel(wx, wy, wz, sx, sy, sz, 0);
    }
  }

  return fragments;
}
